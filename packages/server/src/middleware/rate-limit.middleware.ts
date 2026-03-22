import { FastifyRequest, FastifyReply } from 'fastify';
import { RATE_LIMIT } from '@cloud-dock/shared';
import { rateLimited } from '../utils/response.js';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60_000);

export function rateLimit(
  request: FastifyRequest,
  reply: FastifyReply,
  windowMs = RATE_LIMIT.windowMs,
  maxRequests = RATE_LIMIT.requestsPerWindow
): void {
  // Use IP as the key
  const ip = request.ip || request.headers['x-forwarded-for']?.toString() || 'unknown';
  const key = `rate_limit:${ip}`;

  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    // Start new window
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return;
  }

  entry.count++;

  if (entry.count > maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    reply.header('Retry-After', retryAfter.toString());
    reply.header('X-RateLimit-Limit', maxRequests.toString());
    reply.header('X-RateLimit-Remaining', '0');
    reply.header('X-RateLimit-Reset', entry.resetAt.toString());
    rateLimited(reply, `Rate limit exceeded. Try again in ${retryAfter} seconds.`);
    return;
  }

  // Add rate limit headers
  reply.header('X-RateLimit-Limit', maxRequests.toString());
  reply.header('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count).toString());
  reply.header('X-RateLimit-Reset', entry.resetAt.toString());
}
