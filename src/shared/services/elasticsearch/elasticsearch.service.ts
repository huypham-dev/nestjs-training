// Dependencies
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ElasticsearchService as NestElasticsearchService } from '@nestjs/elasticsearch';

// Interface
import type {
  IElasticsearchService,
  SearchResult,
} from './elasticsearch.interface';

/**
 * Elasticsearch Service
 *
 * Wraps @nestjs/elasticsearch with a clean interface.
 * Provides structured logging, error handling, and easy swapping.
 *
 * To switch to another search engine (e.g. OpenSearch, Algolia):
 * 1. Create a new service implementing IElasticsearchService
 * 2. Swap the provider in SharedModule
 * 3. No changes needed in consumers
 */
@Injectable()
export class ElasticsearchService
  implements IElasticsearchService, OnModuleInit
{
  private readonly logger = new Logger(ElasticsearchService.name);

  constructor(private readonly client: NestElasticsearchService) {}

  async onModuleInit(): Promise<void> {
    try {
      const health = await this.client.cluster.health();
      this.logger.log(
        `Elasticsearch connected - cluster status: ${health.status}`
      );
    } catch (error) {
      this.logger.warn(
        `Elasticsearch connection failed: ${error.message}. Search features may be unavailable.`
      );
    }
  }

  /**
   * Index a document (create or replace)
   * @param index - The name of the index
   * @param id - The document ID
   * @param document - The document to index
   *
   * This method will create a new document or replace an existing one with the same ID.
   */
  async index<T extends Record<string, unknown>>(
    index: string,
    id: string,
    document: T
  ): Promise<void> {
    try {
      await this.client.index({ index, id, document });
    } catch (error) {
      this.logger.error(
        `Failed to index document ${id} in [${index}]: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Partially update a document
   * @param index - The name of the index
   * @param id - The document ID
   * @param partialDocument - The partial document with fields to update
   *
   * This method will update only the specified fields in the existing document. If the document does not exist, it will throw an error.
   */
  async update<T extends Record<string, unknown>>(
    index: string,
    id: string,
    partialDocument: Partial<T>
  ): Promise<void> {
    try {
      await this.client.update({
        index,
        id,
        doc: partialDocument,
      });
    } catch (error) {
      this.logger.error(
        `Failed to update document ${id} in [${index}]: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Delete a document
   * @param index - The name of the index
   * @param id - The document ID
   *
   * Deletes the document with the specified ID from the index.
   */
  async delete(index: string, id: string): Promise<void> {
    try {
      await this.client.delete({ index, id });
    } catch (error) {
      // Ignore 404 - document may not be in ES (e.g., ES was down during creation)
      if (error?.meta?.statusCode === 404) {
        this.logger.debug(
          `Document ${id} not found in [${index}] - skipping delete`
        );
        return;
      }
      this.logger.error(
        `Failed to delete document ${id} from [${index}]: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Search for documents
   * @param index - The name of the index
   * @param query - The search query
   *
   * Returns a structured SearchResult with hits and total count.
   */
  async search<T>(
    index: string,
    query: Record<string, unknown>
  ): Promise<SearchResult<T>> {
    try {
      const response = await this.client.search<T>({ index, ...query });

      const total =
        typeof response.hits.total === 'number'
          ? response.hits.total
          : (response.hits.total?.value ?? 0);

      return {
        hits: response.hits.hits.map((hit: (typeof response.hits.hits)[0]) => ({
          id: hit._id!,
          score: hit._score ?? 0,
          source: hit._source as T,
        })),
        total,
      };
    } catch (error) {
      this.logger.error(`Search failed in [${index}]: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ensure an index exists
   * @param index - The name of the index
   * @param mappings - The index mappings
   *
   * Checks if the index exists and creates it with the provided mappings if it doesn't.
   */
  async ensureIndex(
    index: string,
    mappings: Record<string, unknown>
  ): Promise<void> {
    try {
      const exists = await this.client.indices.exists({ index });
      if (!exists) {
        await this.client.indices.create({
          index,
          mappings,
        } as Parameters<typeof this.client.indices.create>[0]);
        this.logger.log(`Created Elasticsearch index: [${index}]`);
      }
    } catch (error) {
      this.logger.error(`Failed to ensure index [${index}]: ${error.message}`);
      throw error;
    }
  }
}
