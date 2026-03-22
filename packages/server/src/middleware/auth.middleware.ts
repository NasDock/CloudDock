import { FastifyRequest, FastifyReply } from 'fastify';
import { unauthorized } from '../utils/response.js';

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify();
    // Map JWT 'sub' claim to 'userId' (JWT standard doesn't use 'userId')
    (request.user as any).userId = request.user.sub;
  } catch {
    unauthorized(reply, 'Invalid or expired token');
  }
}

export async function authenticateOptional(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify();
    (request.user as any).userId = request.user.sub;
  } catch {
    // Silently ignore - user is optional
  }
}
