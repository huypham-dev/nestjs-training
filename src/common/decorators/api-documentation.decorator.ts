import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import type {
  ApiOperationOptions,
  ApiResponseOptions,
  ApiBodyOptions,
  ApiParamOptions,
  ApiQueryOptions,
} from '@nestjs/swagger';

interface ApiDocumentationOptions {
  operation: ApiOperationOptions;
  response: ApiResponseOptions | ApiResponseOptions[];
  body?: ApiBodyOptions;
  params?: ApiParamOptions[];
  query?: ApiQueryOptions[];
}

/**
 * Custom decorator to group common Swagger decorators
 * Reduces boilerplate by combining @ApiOperation, @ApiResponse, @ApiBody, @ApiParam, @ApiQuery
 *
 * @example
 * ```typescript
 * @ApiDocumentation({
 *   operation: {
 *     summary: 'Get user by ID',
 *     description: 'Retrieve a single user by UUID',
 *   },
 *   params: [
 *     {
 *       name: 'id',
 *       type: 'string',
 *       format: 'uuid',
 *       description: 'User UUID',
 *     },
 *   ],
 *   response: {
 *     status: 200,
 *     description: 'Successfully retrieved user',
 *     schema: {
 *       type: 'object',
 *       properties: {
 *         data: { $ref: '#/components/schemas/UserResponse' },
 *       },
 *     },
 *   },
 * })
 * ```
 */
export function ApiDocumentation(options: ApiDocumentationOptions) {
  const decorators: Array<
    ClassDecorator | MethodDecorator | PropertyDecorator
  > = [];

  // Add operation decorator
  decorators.push(ApiOperation(options.operation));

  // Add response decorator(s)
  if (Array.isArray(options.response)) {
    options.response.forEach((response) => {
      decorators.push(ApiResponse(response));
    });
  } else {
    decorators.push(ApiResponse(options.response));
  }

  // Add body decorator if provided
  if (options.body) {
    decorators.push(ApiBody(options.body));
  }

  // Add param decorators if provided
  if (options.params) {
    options.params.forEach((param) => {
      decorators.push(ApiParam(param));
    });
  }

  // Add query decorators if provided
  if (options.query) {
    options.query.forEach((query) => {
      decorators.push(ApiQuery(query));
    });
  }

  return applyDecorators(...decorators);
}
