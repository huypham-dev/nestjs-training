import { PostStatus } from '@/constants';

/**
 * PostDocument
 *
 * Represents the shape of a Post document stored in Elasticsearch.
 * Keep this flat and denormalized for optimal search performance.
 */
export interface PostDocument {
  id: string;
  title: string;
  content: string;
  status: PostStatus;
  authorId: string;
  authorName: string;
  authorEmail: string;
  categoryIds: string[];
  categoryNames: string[];
  imageUrl: string | null;
  imageThumbnailUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Elasticsearch index name for posts
 */
export const POST_INDEX = 'posts';

/**
 * Elasticsearch index mappings for the posts index.
 * Defines field types for optimal search behavior.
 */
export const POST_INDEX_MAPPINGS = {
  properties: {
    id: { type: 'keyword' },
    title: {
      type: 'text',
      analyzer: 'standard', // tokenize on whitespace and punctuation, lowercase, etc.
      // 'keyword' sub-field for sorting/aggregations
      fields: { keyword: { type: 'keyword', ignore_above: 256 } },
    },
    content: { type: 'text', analyzer: 'standard' },
    status: { type: 'keyword' },
    authorId: { type: 'keyword' },
    authorName: {
      type: 'text',
      fields: { keyword: { type: 'keyword', ignore_above: 256 } },
    },
    authorEmail: { type: 'keyword' },
    categoryIds: { type: 'keyword' },
    categoryNames: { type: 'text' },
    imageUrl: { type: 'keyword', index: false },
    imageThumbnailUrl: { type: 'keyword', index: false },
    publishedAt: { type: 'date' },
    createdAt: { type: 'date' },
    updatedAt: { type: 'date' },
  },
};
