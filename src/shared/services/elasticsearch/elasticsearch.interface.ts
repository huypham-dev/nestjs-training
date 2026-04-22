/**
 * Elasticsearch Service Interface
 *
 * Abstract interface for Elasticsearch operations.
 * Wraps @nestjs/elasticsearch to provide a clean, testable interface.
 * Swap implementation easily (e.g., OpenSearch, Algolia, Typesense).
 *
 * Usage: Inject using ELASTICSEARCH_SERVICE token.
 */

/**
 * Dependency Injection Token
 * Use this token to inject the Elasticsearch service
 */
export const ELASTICSEARCH_SERVICE = Symbol('ELASTICSEARCH_SERVICE');

export interface SearchHit<T> {
  id: string;
  score: number;
  source: T;
}

export interface SearchResult<T> {
  hits: SearchHit<T>[];
  total: number;
}

export interface IElasticsearchService {
  /**
   * Index a document (create or replace)
   */
  index<T extends Record<string, unknown>>(
    index: string,
    id: string,
    document: T
  ): Promise<void>;

  /**
   * Partially update a document
   */
  update<T extends Record<string, unknown>>(
    index: string,
    id: string,
    partialDocument: Partial<T>
  ): Promise<void>;

  /**
   * Delete a document by ID
   */
  delete(index: string, id: string): Promise<void>;

  /**
   * Search documents with a raw ES query
   */
  search<T>(
    index: string,
    query: Record<string, unknown>
  ): Promise<SearchResult<T>>;

  /**
   * Check if an index exists and create it with mappings if not
   */
  ensureIndex(index: string, mappings: Record<string, unknown>): Promise<void>;
}
