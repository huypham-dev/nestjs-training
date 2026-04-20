// Dependencies
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
  PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';

// Interfaces
import type {
  IStorageService,
  UploadResult,
  UploadOptions,
  ProcessedImage,
  ThumbnailOptions,
} from './storage.interface';

/**
 * S3 Storage Service Implementation
 *
 * Implements IStorageService using AWS S3 as the storage backend.
 * To switch to another provider (Cloudinary, GCS, etc.), create a new
 * implementation of IStorageService and update the provider in shared.module.ts
 */
@Injectable()
export class S3StorageService implements IStorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly baseUrl: string;
  private readonly DEFAULT_THUMBNAIL_WIDTH = 400;
  private readonly DEFAULT_QUALITY = 80;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET') || '';

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || '',
        secretAccessKey:
          this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '',
      },
    });

    // Construct base URL for S3 objects
    this.baseUrl = `https://${this.bucket}.s3.${this.region}.amazonaws.com`;

    if (!this.bucket) {
      this.logger.warn('AWS_S3_BUCKET is not configured');
    }
  }

  /**
   * Upload a file buffer to S3
   * Returns the uploaded file's key and public URL
   */
  async uploadFile(
    buffer: Buffer,
    filename: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const {
      folder = 'uploads',
      contentType = 'application/octet-stream',
      metadata = {},
    } = options;

    const key = folder ? `${folder}/${filename}` : filename;

    try {
      const params: PutObjectCommandInput = {
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: metadata,
      };

      const command = new PutObjectCommand(params);
      await this.s3Client.send(command);

      const url = `${this.baseUrl}/${key}`;

      this.logger.log(`File uploaded successfully: ${key}`);

      return {
        key,
        url,
        bucket: this.bucket,
      };
    } catch (error) {
      this.logger.error(`Failed to upload file: ${error}`);
      throw new Error('Failed to upload file to S3');
    }
  }

  /**
   * Upload an image with automatic thumbnail generation
   * Implements IStorageService interface
   */
  async uploadImageWithThumbnail(
    buffer: Buffer,
    filename: string,
    options: UploadOptions = {}
  ): Promise<{ original: UploadResult; thumbnail: UploadResult }> {
    try {
      const uniqueFilename = this.generateUniqueFilename(filename);
      const folder = options.folder || 'posts/images';

      // Generate thumbnail
      const thumbnailData = await this.generateThumbnail(buffer);

      // Upload both original and thumbnail in parallel
      const [original, thumbnail] = await Promise.all([
        this.uploadFile(buffer, uniqueFilename, {
          ...options,
          folder: `${folder}/original`,
          contentType: 'image/jpeg',
        }),
        this.uploadFile(thumbnailData.buffer, `thumb-${uniqueFilename}`, {
          ...options,
          folder: `${folder}/thumbnails`,
          contentType: 'image/jpeg',
        }),
      ]);

      return { original, thumbnail };
    } catch (error) {
      this.logger.error('Failed to upload image and thumbnail:', error);
      throw new Error('Failed to upload images');
    }
  }

  /**
   * Generate unique filename with timestamp and random string
   */
  generateUniqueFilename(originalFilename: string): string {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const extension = originalFilename.split('.').pop() || 'jpg';
    const nameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '');
    return `${timestamp}-${randomString}-${nameWithoutExt}.${extension}`;
  }

  /**
   * Delete multiple files from S3
   */
  async deleteFiles(keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    try {
      const command = new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: {
          Objects: keys.map((key) => ({ Key: key })),
        },
      });

      await this.s3Client.send(command);
      this.logger.log(`Deleted ${keys.length} files from S3`);
    } catch (error) {
      this.logger.error('Failed to delete files:', error);
      throw new Error('Failed to delete files from S3');
    }
  }

  /**
   * Extract S3 key from URL
   * Helper method to get the key from a full S3 URL
   */
  extractKeyFromUrl(url: string): string | null {
    try {
      // Handle S3 URLs in format: https://bucket.s3.region.amazonaws.com/key
      const urlObj = new URL(url);
      return urlObj.pathname.substring(1); // Remove leading slash
    } catch {
      return null;
    }
  }

  /**
   * Delete image and thumbnail by URLs
   */
  async deleteImageByUrls(
    imageUrl?: string | null,
    thumbnailUrl?: string | null
  ): Promise<void> {
    const keysToDelete: string[] = [];

    if (imageUrl) {
      const key = this.extractKeyFromUrl(imageUrl);
      if (key) keysToDelete.push(key);
    }

    if (thumbnailUrl) {
      const key = this.extractKeyFromUrl(thumbnailUrl);
      if (key) keysToDelete.push(key);
    }

    if (keysToDelete.length > 0) {
      await this.deleteFiles(keysToDelete);
    }
  }

  /**
   * Process and optimize an image
   * Converts to JPEG and compresses
   */
  async processImage(
    buffer: Buffer,
    options: ThumbnailOptions = {}
  ): Promise<ProcessedImage> {
    const { quality = this.DEFAULT_QUALITY } = options;

    try {
      const processed = await sharp(buffer)
        .jpeg({ quality, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });

      return {
        buffer: processed.data,
        width: processed.info.width,
        height: processed.info.height,
        format: processed.info.format,
        size: processed.info.size,
      };
    } catch (error) {
      this.logger.error('Error processing image:', error);
      throw new Error('Failed to process image');
    }
  }

  /**
   * Generate a thumbnail from an image buffer
   * Resizes to specified width while maintaining aspect ratio
   */
  async generateThumbnail(
    buffer: Buffer,
    options: ThumbnailOptions = {}
  ): Promise<ProcessedImage> {
    const {
      width = this.DEFAULT_THUMBNAIL_WIDTH,
      height,
      quality = this.DEFAULT_QUALITY,
      fit = 'inside',
    } = options;

    try {
      const processed = await sharp(buffer)
        .resize(width, height, {
          fit,
          withoutEnlargement: true,
        })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });

      return {
        buffer: processed.data,
        width: processed.info.width,
        height: processed.info.height,
        format: processed.info.format,
        size: processed.info.size,
      };
    } catch (error) {
      this.logger.error('Error generating thumbnail:', error);
      throw new Error('Failed to generate thumbnail');
    }
  }
}
