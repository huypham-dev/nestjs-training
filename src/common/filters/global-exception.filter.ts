// Dependencies
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

// Exceptions
import { DomainException } from '@/common/exceptions/base.exception';

// Interfaces
import { ErrorResponse } from '@/common/interfaces/response.interface';

// Constants
import { ErrorCodes, Environment } from '@/constants';
import { ConfigService } from '@nestjs/config';

/**
 * Global exception filter that catches all exceptions
 * and formats them into a standardized error response
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);
  private readonly isDevelopment: boolean;

  constructor(private readonly configService: ConfigService) {
    this.isDevelopment =
      this.configService.get<string>('NODE_ENV') === Environment.Development;
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = this.buildErrorResponse(exception);

    // Log the error
    this.logError(exception, request, errorResponse);

    // Send the response
    response.status(errorResponse.status).json(errorResponse.body);
  }

  /**
   * Builds a standardized error response based on the exception type
   */
  private buildErrorResponse(exception: unknown): {
    status: number;
    body: ErrorResponse;
  } {
    // Handle DomainException (our custom exceptions)
    if (exception instanceof DomainException) {
      const statusCode = exception.getStatus();
      return {
        status: statusCode,
        body: {
          statusCode,
          code: exception.code,
          message: exception.message,
          ...(exception.context?.errors && {
            errors: exception.context.errors,
          }),
          ...(this.isDevelopment && { stack: exception.stack }),
        },
      };
    }

    // Handle standard NestJS HttpException
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Handle validation errors from class-validator or Zod
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const response = exceptionResponse as any;

        return {
          status,
          body: {
            statusCode: status,
            code: this.getCodeFromStatus(status),
            message: response.message || exception.message,
            ...(response.details && { errors: response.details }),
            ...(this.isDevelopment && { stack: exception.stack }),
          },
        };
      }

      return {
        status,
        body: {
          statusCode: status,
          code: this.getCodeFromStatus(status),
          message: exception.message,
          ...(this.isDevelopment && { stack: exception.stack }),
        },
      };
    }

    // Handle unknown errors (system errors)
    return this.handleUnknownError(exception);
  }

  /**
   * Handles unknown/unexpected errors
   */
  private handleUnknownError(exception: unknown): {
    status: number;
    body: ErrorResponse;
  } {
    const status = HttpStatus.INTERNAL_SERVER_ERROR;

    // In production, hide internal error details
    const message = this.isDevelopment
      ? exception instanceof Error
        ? exception.message
        : 'An unexpected error occurred'
      : 'An unexpected error occurred. Please try again later.';

    const stack =
      this.isDevelopment && exception instanceof Error
        ? exception.stack
        : undefined;

    return {
      status,
      body: {
        statusCode: status,
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message,
        ...(stack && { stack }),
      },
    };
  }

  /**
   * Maps HTTP status codes to error codes
   */
  private getCodeFromStatus(status: number): string {
    const statusCodeMap: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: ErrorCodes.BAD_REQUEST,
      [HttpStatus.UNAUTHORIZED]: ErrorCodes.UNAUTHORIZED,
      [HttpStatus.FORBIDDEN]: ErrorCodes.FORBIDDEN,
      [HttpStatus.NOT_FOUND]: ErrorCodes.NOT_FOUND,
      [HttpStatus.METHOD_NOT_ALLOWED]: ErrorCodes.METHOD_NOT_ALLOWED,
      [HttpStatus.TOO_MANY_REQUESTS]: ErrorCodes.TOO_MANY_REQUESTS,
      [HttpStatus.INTERNAL_SERVER_ERROR]: ErrorCodes.INTERNAL_SERVER_ERROR,
    };

    return statusCodeMap[status] || 'UNKNOWN_ERROR';
  }

  /**
   * Logs the error with appropriate level and details
   */
  private logError(
    exception: unknown,
    request: Request,
    errorResponse: { status: number; body: ErrorResponse }
  ) {
    const { status, body } = errorResponse;
    const { method, url } = request;

    const logContext = {
      method,
      url,
      status,
      code: body.code,
      message: body.message,
      ...(body.errors && { errors: body.errors }),
    };

    // Log as error for 5xx, warn for 4xx
    if (status >= 500) {
      this.logger.error(
        `[${method}] ${url} - ${body.code}: ${body.message}`,
        exception instanceof Error ? exception.stack : undefined,
        JSON.stringify(logContext)
      );
    } else if (status >= 400) {
      this.logger.warn(
        `[${method}] ${url} - ${body.code}: ${body.message}`,
        JSON.stringify(logContext)
      );
    }
  }
}
