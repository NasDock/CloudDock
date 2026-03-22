import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { AuthController } from './auth.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { rateLimit } from '../../middleware/rate-limit.middleware.js';

const authRoute: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const controller = new AuthController(fastify);

  // Apply rate limiting to auth endpoints
  fastify.addHook('preHandler', async (request, reply) => {
    rateLimit(request, reply, 60_000, 100); // 100 requests per minute
  });

  fastify.post('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password', 'username'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8, maxLength: 128 },
          username: { type: 'string', minLength: 1, maxLength: 100 },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                userId: { type: 'string' },
                email: { type: 'string' },
                username: { type: 'string' },
              },
            },
          },
        },
      },
    },
    handler: controller.register.bind(controller),
  });

  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
    },
    handler: controller.login.bind(controller),
  });

  fastify.post('/refresh', {
    schema: {
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' },
        },
      },
    },
    handler: controller.refresh.bind(controller),
  });

  fastify.post('/logout', {
    preHandler: [authenticate],
    handler: controller.logout.bind(controller),
  });
};

export default authRoute;
