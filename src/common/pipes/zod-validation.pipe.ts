// Dependencies
import { Injectable, PipeTransform } from '@nestjs/common';
import { z } from 'zod';

// Exceptions
import { ValidationException } from '../exceptions';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: z.ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      throw new ValidationException('Validation failed', details);
    }

    return result.data;
  }
}
