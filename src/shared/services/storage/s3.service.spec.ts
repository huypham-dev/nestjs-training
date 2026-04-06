import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './s3.service';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import sharp from 'sharp';

jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({
      send: jest.fn(),
    })),
    PutObjectCommand: jest.fn(),
    DeleteObjectsCommand: jest.fn(),
  };
});

jest.mock('sharp', () => {
  const sharpMock = jest.fn(() => ({
    resize: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue({
      data: Buffer.from('mock-processed-image'),
      info: {
        width: 800,
        height: 600,
        format: 'jpeg',
        size: 1024,
      },
    }),
  }));
  return sharpMock;
});

describe('StorageService', () => {
  let service: StorageService;
  let s3ClientInstance: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'AWS_REGION') return 'us-east-1';
        if (key === 'AWS_S3_BUCKET') return 'test-bucket';
        if (key === 'AWS_ACCESS_KEY_ID') return 'aws-access';
        if (key === 'AWS_SECRET_ACCESS_KEY') return 'aws-secret';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
    s3ClientInstance = (S3Client as jest.Mock).mock.results[0].value;
  });

  describe('uploadFile', () => {
    it('should upload a file and return its URL and key', async () => {
      s3ClientInstance.send.mockResolvedValue({});

      const buffer = Buffer.from('test-file');
      const filename = 'test.jpg';

      const result = await service.uploadFile(buffer, filename, {
        folder: 'posts',
      });

      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'test-bucket',
          Key: 'posts/test.jpg',
          Body: buffer,
        })
      );
      expect(s3ClientInstance.send).toHaveBeenCalled();
      expect(result).toEqual({
        key: 'posts/test.jpg',
        url: 'https://test-bucket.s3.us-east-1.amazonaws.com/posts/test.jpg',
        bucket: 'test-bucket',
      });
    });

    it('should throw an error if S3 upload fails', async () => {
      s3ClientInstance.send.mockRejectedValue(new Error('S3 upload error'));

      const buffer = Buffer.from('test-file');
      await expect(service.uploadFile(buffer, 'test.jpg')).rejects.toThrow(
        'Failed to upload file to S3'
      );
    });
  });

  describe('uploadImage', () => {
    it('should upload original and thumbnail images concurrently', async () => {
      // Mock uploadFile
      jest.spyOn(service, 'uploadFile').mockImplementation(
        async (buf, name) =>
          await Promise.resolve({
            key: `mock-key-${name}`,
            url: `https://url-${name}`,
            bucket: 'test-bucket',
          })
      );

      const origBuf = Buffer.from('original');
      const thumbBuf = Buffer.from('thumb');

      const result = await service.uploadImage(
        origBuf,
        thumbBuf,
        'cat.jpg',
        'images'
      );

      expect(service.uploadFile).toHaveBeenCalledTimes(2);
      expect(result.original).toBeDefined();
      expect(result.thumbnail).toBeDefined();
    });
  });

  describe('deleteFiles', () => {
    it('should do nothing if keys array is empty', async () => {
      await service.deleteFiles([]);
      expect(s3ClientInstance.send).not.toHaveBeenCalled();
    });

    it('should call s3Client.send with DeleteObjectsCommand', async () => {
      s3ClientInstance.send.mockResolvedValue({});

      await service.deleteFiles(['key1.jpg', 'key2.jpg']);

      expect(DeleteObjectsCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'test-bucket',
          Delete: {
            Objects: [{ Key: 'key1.jpg' }, { Key: 'key2.jpg' }],
          },
        })
      );
      expect(s3ClientInstance.send).toHaveBeenCalled();
    });

    it('should throw an error if deletion fails', async () => {
      s3ClientInstance.send.mockRejectedValue(new Error('S3 error'));
      await expect(service.deleteFiles(['key1'])).rejects.toThrow(
        'Failed to delete files from S3'
      );
    });
  });

  describe('extractKeyFromUrl', () => {
    it('should correctly extract the key from a standard S3 URL', () => {
      const url =
        'https://test-bucket.s3.us-east-1.amazonaws.com/posts/images/test.jpg';
      const key = service.extractKeyFromUrl(url);
      expect(key).toBe('posts/images/test.jpg');
    });

    it('should return null for invalid URLs', () => {
      expect(service.extractKeyFromUrl('not-a-valid-url')).toBeNull();
    });
  });

  describe('deleteImageByUrls', () => {
    it('should collect valid keys from urls and call deleteFiles', async () => {
      jest.spyOn(service, 'deleteFiles').mockResolvedValue();
      const origUrl = 'https://s3.amazonaws.com/folder/img1.jpg';
      const thumbUrl = 'https://s3.amazonaws.com/folder/thumb1.jpg';

      await service.deleteImageByUrls(origUrl, thumbUrl);

      expect(service.deleteFiles).toHaveBeenCalledWith([
        'folder/img1.jpg',
        'folder/thumb1.jpg',
      ]);
    });

    it('should not call deleteFiles if no valid URLs provided', async () => {
      jest.spyOn(service, 'deleteFiles').mockResolvedValue();
      await service.deleteImageByUrls(null, undefined);
      expect(service.deleteFiles).not.toHaveBeenCalled();
    });
  });

  describe('processImage', () => {
    it('should call sharp to process an image', async () => {
      const buf = Buffer.from('raw-image');
      const processed = await service.processImage(buf, 80);

      expect(sharp).toHaveBeenCalledWith(buf);
      expect(processed.size).toBe(1024);
      expect(processed.format).toBe('jpeg');
    });

    it('should throw error if sharp fails', async () => {
      (sharp as unknown as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Sharp processing failed');
      });

      await expect(service.processImage(Buffer.from(''))).rejects.toThrow(
        'Failed to process image'
      );
    });
  });

  describe('generateThumbnail', () => {
    it('should call sharp with resize and jpeg commands', async () => {
      const buf = Buffer.from('raw-image');
      const thumbnail = await service.generateThumbnail(buf, { width: 400 });

      expect(sharp).toHaveBeenCalledWith(buf);

      const sharpInstance = (sharp as unknown as jest.Mock).mock.results[0]
        .value;
      expect(sharpInstance.resize).toHaveBeenCalledWith(400, undefined, {
        fit: 'inside',
        withoutEnlargement: true,
      });
      expect(sharpInstance.jpeg).toHaveBeenCalledWith({
        quality: 80,
        mozjpeg: true,
      });

      expect(thumbnail.buffer).toBeDefined();
    });
  });
});
