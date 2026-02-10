/**
 * Standardized error response format
 */
export interface ErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  errors?: any;
  stack?: string;
}

/**
 * Success response format (for consistency)
 */
export interface SuccessResponse<T = any> {
  data: T;
  meta?: {
    pagination: {
      offset: number;
      limit: number;
      total: number;
    };
  };
}

export interface QueryOptions {
  offset?: number;
  limit?: number;
}
