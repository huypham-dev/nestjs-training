/**
 * Storage Service Interface
 *
 * Abstract interface for file storage operations.
 * Implementations: S3StorageService, CloudinaryService, LocalStorageService, etc.
 */

/**
 * Dependency Injection Token
 * Use this token to inject the storage service
 */
export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');

export interface UploadResult {
  key: string;
  url: string;
  bucket: string;
}

export interface UploadOptions {
  folder?: string;
  contentType?: string;
  metadata?: Record<string, string>;
}

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
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

export interface IStorageService {
  /**
   * Upload a file buffer to storage
   * @param buffer - File buffer
   * @param filename - Original filename
   * @param options - Upload options
   * @returns Upload result with key and URL
   */
  uploadFile(
    buffer: Buffer,
    filename: string,
    options?: UploadOptions
  ): Promise<UploadResult>;

  /**
   * Upload an image with automatic thumbnail generation
   * @param buffer - Image buffer
   * @param filename - Original filename
   * @param options - Upload options
   * @returns Object with original and thumbnail upload results
   */
  uploadImageWithThumbnail(
    buffer: Buffer,
    filename: string,
    options?: UploadOptions
  ): Promise<{
    original: UploadResult;
    thumbnail: UploadResult;
  }>;

  /**
   * Delete multiple files from storage
   * @param keys - Array of file keys to delete
   */
  deleteFiles(keys: string[]): Promise<void>;

  /**
   * Process image buffer (resize, compress, etc.)
   * @param buffer - Image buffer
   * @param options - Thumbnail options
   * @returns Processed image data
   */
  processImage(
    buffer: Buffer,
    options?: ThumbnailOptions
  ): Promise<ProcessedImage>;

  /**
   * Generate unique filename with timestamp and random string
   * @param originalFilename - Original filename
   * @returns Unique filename
   */
  generateUniqueFilename(originalFilename: string): string;

  /**
   * Generate a thumbnail from an image buffer
   * @param buffer - Image buffer
   * @param options - Thumbnail options
   * @returns Processed thumbnail data
   */
  generateThumbnail(
    buffer: Buffer,
    options?: ThumbnailOptions
  ): Promise<ProcessedImage>;

  /**
   * Delete image and thumbnail by URLs
   * @param imageUrl - Original image URL
   * @param thumbnailUrl - Thumbnail URL
   */
  deleteImageByUrls(
    imageUrl?: string | null,
    thumbnailUrl?: string | null
  ): Promise<void>;
}
