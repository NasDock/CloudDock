import { FastifyReply } from 'fastify';
import { ApiResponse, ApiError, ErrorCodes } from '@cloud-dock/shared';

export function success<T>(reply: FastifyReply, data: T, statusCode = 200): FastifyReply {
  return reply.status(statusCode).send({
    success: true,
    data,
  } satisfies ApiResponse<T>);
}

export function successMessage(
  reply: FastifyReply,
  message: string,
  statusCode = 200
): FastifyReply {
  return reply.status(statusCode).send({
    success: true,
    message,
  } satisfies ApiResponse);
}

export function error(
  reply: FastifyReply,
  code: (typeof ErrorCodes)[keyof typeof ErrorCodes],
  message: string,
  statusCode: number,
  details?: Record<string, unknown>
): FastifyReply {
  const err: ApiError = { code, message };
  if (details) err.details = details;

  return reply.status(statusCode).send({
    success: false,
    error: err,
  } satisfies ApiResponse);
}

export function validationError(
  reply: FastifyReply,
  message: string,
  details?: Record<string, unknown>
): FastifyReply {
  return error(reply, ErrorCodes.VALIDATION_ERROR, message, 400, details);
}

export function unauthorized(reply: FastifyReply, message = 'Unauthorized'): FastifyReply {
  return error(reply, ErrorCodes.UNAUTHORIZED, message, 401);
}

export function forbidden(reply: FastifyReply, message = 'Forbidden'): FastifyReply {
  return error(reply, ErrorCodes.FORBIDDEN, message, 403);
}

export function notFound(reply: FastifyReply, message = 'Resource not found'): FastifyReply {
  return error(reply, ErrorCodes.NOT_FOUND, message, 404);
}

export function conflict(reply: FastifyReply, message: string): FastifyReply {
  return error(reply, ErrorCodes.CONFLICT, message, 409);
}

export function rateLimited(reply: FastifyReply, message = 'Too many requests'): FastifyReply {
  return error(reply, ErrorCodes.RATE_LIMITED, message, 429);
}

export function internalError(
  reply: FastifyReply,
  message = 'Internal server error'
): FastifyReply {
  return error(reply, ErrorCodes.INTERNAL_ERROR, message, 500);
}
