import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { ErrorCodes } from '@cloud-dock/shared';
import { validationError, internalError } from '../utils/response.js';

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  request.log.error({ err: error }, 'Request error');

  // Zod validation errors
  if (error instanceof ZodError) {
    const details: Record<string, unknown> = {};
    error.errors.forEach((e) => {
      const path = e.path.join('.');
      details[path] = e.message;
    });
    validationError(reply, 'Validation failed', details);
    return;
  }

  // Fastify validation errors (e.g., schema validation)
  if (error.validation) {
    const details: Record<string, unknown> = {};
    error.validation.forEach((v) => {
      const path = v.instancePath || String(v.params?.missingProperty) || 'unknown';
      details[path] = v.message;
    });
    validationError(reply, 'Validation failed', details);
    return;
  }

  // Handle known error codes
  const statusCode = error.statusCode || 500;
  const errorCode =
    statusCode === 400
      ? ErrorCodes.VALIDATION_ERROR
      : statusCode === 401
        ? ErrorCodes.UNAUTHORIZED
        : statusCode === 403
          ? ErrorCodes.FORBIDDEN
          : statusCode === 404
            ? ErrorCodes.NOT_FOUND
            : statusCode === 409
              ? ErrorCodes.CONFLICT
              : statusCode === 429
                ? ErrorCodes.RATE_LIMITED
                : ErrorCodes.INTERNAL_ERROR;

  reply.status(statusCode).send({
    success: false,
    error: {
      code: errorCode,
      message: statusCode >= 500 ? 'Internal server error' : error.message,
    },
  });
}
