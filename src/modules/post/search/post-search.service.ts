// Dependencies
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';

// Shared
import {
  ELASTICSEARCH_SERVICE,
  type IElasticsearchService,
  type SearchResult,
} from '@/shared/services/elasticsearch';

// Entities
import type { Post } from '../post.entity';

// Document
import {
  POST_INDEX,
  POST_INDEX_MAPPINGS,
  type PostDocument,
} from './post-search.document';

// Constants
import { PostStatus } from '@/constants';

export interface PostSearchOptions {
  keyword: string;
  offset?: number;
  limit?: number;
  status?: PostStatus;
}

/**
 * PostSearchService
 *
 * Handles all Elasticsearch operations for the Post domain:
 * - Index management (create index with proper mappings on startup)
 * - Document indexing on create/update
 * - Document removal on delete
 * - Full-text search with filtering & pagination
 */
@Injectable()
export class PostSearchService implements OnModuleInit {
  private readonly logger = new Logger(PostSearchService.name);

  constructor(
    @Inject(ELASTICSEARCH_SERVICE)
    private readonly searchService: IElasticsearchService
  ) {}

  async onModuleInit(): Promise<void> {
    await this.searchService
      .ensureIndex(POST_INDEX, POST_INDEX_MAPPINGS)
      .catch((error) => {
        this.logger.warn(
          `Could not ensure posts index on startup: ${error.message}`
        );
      });
  }

  /**
   * Convert a Post entity to a flat PostDocument for Elasticsearch.
   * Called on create/update to keep index in sync.
   */
  toDocument(post: Post): PostDocument {
    return {
      id: post.id,
      title: post.title,
      content: post.content,
      status: post.status as PostStatus,
      authorId: post.user?.id ?? '',
      authorName: post.user?.fullName ?? '',
      authorEmail: post.user?.email ?? '',
      categoryIds: post.categories.isInitialized()
        ? post.categories.getItems().map((c) => c.id)
        : [],
      categoryNames: post.categories.isInitialized()
        ? post.categories.getItems().map((c) => c.name)
        : [],
      imageUrl: post.imageUrl ?? null,
      imageThumbnailUrl: post.imageThumbnailUrl ?? null,
      publishedAt: post.publishedAt?.toISOString() ?? null,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  }

  /**
   * Index (create or replace) a post document in Elasticsearch.
   * Fire-and-forget - caller should not await if non-blocking is desired.
   */
  async indexPost(post: Post): Promise<void> {
    const document = this.toDocument(post);
    await this.searchService.index(
      POST_INDEX,
      post.id,
      document as unknown as Record<string, unknown>
    );
    this.logger.debug(`Indexed post [${post.id}] in Elasticsearch`);
  }

  /**
   * Partially update a post document in Elasticsearch.
   * Only updates the changed fields - more efficient than full re-index.
   */
  async updatePost(post: Post): Promise<void> {
    const partial: Partial<PostDocument> = {
      title: post.title,
      content: post.content,
      status: post.status as PostStatus,
      categoryIds: post.categories.isInitialized()
        ? post.categories.getItems().map((c) => c.id)
        : undefined,
      categoryNames: post.categories.isInitialized()
        ? post.categories.getItems().map((c) => c.name)
        : undefined,
      imageUrl: post.imageUrl ?? null,
      imageThumbnailUrl: post.imageThumbnailUrl ?? null,
      publishedAt: post.publishedAt?.toISOString() ?? null,
      updatedAt: post.updatedAt.toISOString(),
    };

    await this.searchService.update(POST_INDEX, post.id, partial);
    this.logger.debug(`Updated post [${post.id}] in Elasticsearch`);
  }

  /**
   * Remove a post document from Elasticsearch.
   */
  async removePost(postId: string): Promise<void> {
    await this.searchService.delete(POST_INDEX, postId);
    this.logger.debug(`Removed post [${postId}] from Elasticsearch`);
  }

  /**
   * Full-text search across post title and content.
   *
   * Features:
   * - multi_match across title (boosted) and content
   * - Filter by status, authorId, categoryIds
   * - Pagination via offset/limit
   * - Returns raw SearchResult<PostDocument>
   */
  async search(
    options: PostSearchOptions
  ): Promise<SearchResult<PostDocument>> {
    const { keyword, offset = 0, limit = 10, status } = options;

    // Build filters based on provided options
    const filters: Record<string, unknown>[] = [];

    if (status) {
      filters.push({ term: { status } });
    }

    const query = {
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: keyword,
                fields: [
                  'title^3', // boost title matches
                  'content',
                  'authorName',
                  'authorEmail',
                  'categoryNames',
                ],
                type: 'best_fields', // find the single best matching field for scoring
                fuzziness: 'AUTO', // typo tolerance
              },
            },
          ],
          // Apply filters for status
          filter: filters,
        },
      },
      from: offset,
      size: limit,
      highlight: {
        fields: {
          title: {},
          content: { fragment_size: 150, number_of_fragments: 1 },
        },
      },
    };

    return this.searchService.search<PostDocument>(POST_INDEX, query);
  }
}
