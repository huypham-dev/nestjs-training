// Dependencies
import { HttpException, HttpStatus } from '@nestjs/common';

// Constants
import { ErrorCodes } from '@/constants';

/**
 * Base domain exception that all custom exceptions should extend
 * Provides structured error information for consistent error handling
 */
export abstract class DomainException extends HttpException {
  readonly code: string = 'DOMAIN_ERROR';

  /**
   * Additional context or metadata about the error
   */
  readonly context?: Record<string, any>;

  constructor(
    message: string,
    status: HttpStatus,
    context?: Record<string, any>
  ) {
    super(message, status);
    this.context = context;
    this.name = this.constructor.name;

    // Maintains proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Exception for resource not found errors
 */
export class ResourceNotFoundException extends DomainException {
  readonly code = ErrorCodes.RESOURCE_NOT_FOUND;

  constructor(message: string) {
    super(message, HttpStatus.NOT_FOUND);
  }
}

/**
 * Exception for duplicate resource errors (e.g., unique constraint violations)
 */
export class DuplicateResourceException extends DomainException {
  readonly code = ErrorCodes.DUPLICATE_RESOURCE;

  constructor(message: string, context?: Record<string, any>) {
    super(message, HttpStatus.CONFLICT, context);
  }
}

/**
 * Exception for inactive user accounts
 */
export class InactiveUserException extends DomainException {
  readonly code = ErrorCodes.AUTH_USER_INACTIVE;

  constructor(message: string) {
    super(message, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

/**
 * Exception for when an operation cannot be performed
 */
export class OperationNotAllowedException extends DomainException {
  readonly code = ErrorCodes.OPERATION_NOT_ALLOWED;

  constructor(message: string) {
    super(message, HttpStatus.FORBIDDEN);
  }
}

/**
 * Exception for rate limiting
 */
export class RateLimitExceededException extends DomainException {
  readonly code = ErrorCodes.RATE_LIMIT_EXCEEDED;

  constructor(message: string = 'Too many requests', retryAfter?: number) {
    super(
      message,
      HttpStatus.TOO_MANY_REQUESTS,
      retryAfter ? { retryAfter } : undefined
    );
  }
}

/**
 * Exception thrown when request validation fails
 * Used for input validation errors (body, query, params)
 */
export class ValidationException extends DomainException {
  readonly code = ErrorCodes.VALIDATION_FAILED;

  constructor(message: string, errors?: Record<string, any>) {
    super(message, HttpStatus.BAD_REQUEST, errors ? { errors } : undefined);
  }
}

/**
 * Exception thrown when authentication fails
 * Used when user is not authenticated or token is invalid
 */
export class AuthenticationException extends DomainException {
  readonly code = ErrorCodes.AUTH_UNAUTHENTICATED;

  constructor(message: string = 'Invalid credentials or user not found') {
    super(message, HttpStatus.UNAUTHORIZED);
  }
}

/**
 * Exception thrown when user lacks required permissions
 * Used when authenticated user doesn't have access rights
 */
export class AuthorizationException extends DomainException {
  readonly code = ErrorCodes.AUTH_FORBIDDEN;

  constructor(
    message: string = 'You do not have permission to perform this action'
  ) {
    super(message, HttpStatus.FORBIDDEN);
  }
}
