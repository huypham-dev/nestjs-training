import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';

export interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
  size: number;
}

export interface ThumbnailOptions {
  width?: number;
  height?: number;
  quality?: number;
  fit?: keyof sharp.FitEnum;
}

@Injectable()
export class ImageProcessingService {
  private readonly logger = new Logger(ImageProcessingService.name);
  private readonly DEFAULT_THUMBNAIL_WIDTH = 400;
  private readonly DEFAULT_QUALITY = 80;

  /**
   * Process and optimize an image
   * Converts to JPEG and compresses
   */
  async processImage(
    buffer: Buffer,
    quality: number = this.DEFAULT_QUALITY
  ): Promise<ProcessedImage> {
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

  /**
   * Validate image buffer
   * Checks if the buffer is a valid image
   */
  async validateImage(buffer: Buffer): Promise<boolean> {
    try {
      await sharp(buffer).metadata();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get image metadata
   */
  async getMetadata(buffer: Buffer): Promise<sharp.Metadata> {
    try {
      return await sharp(buffer).metadata();
    } catch (error) {
      this.logger.error('Error getting image metadata:', error);
      throw new Error('Failed to get image metadata');
    }
  }
}
