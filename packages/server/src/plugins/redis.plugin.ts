import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import Redis from 'ioredis';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
    redisAvailable: boolean;
  }
}

const redisPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    retryStrategy: () => null,
  });

  let available = false;
  let connectAttempted = false;

  redis.on('error', (err) => {
    // Only log if we successfully connected before and now dropped
    if (available) {
      fastify.log.error({ err }, 'Redis connection error');
    }
  });

  try {
    await redis.connect();
    available = true;
    connectAttempted = true;
    fastify.log.info('Redis connected');
  } catch (err: any) {
    connectAttempted = true;
    // Silent — Redis unavailable is expected in dev without Redis
  }

  redis.on('connect', () => {
    available = true;
    fastify.log.info('Redis connected');
  });

  fastify.decorate('redis', redis);
  fastify.decorate('redisAvailable', available);

  fastify.addHook('onClose', async () => {
    await redis.quit().catch(() => {});
  });
};

export default fp(redisPlugin, {
  name: 'redis',
});
