import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { TunnelController } from './tunnel.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireApprovedRequestDevice } from '../../middleware/request-device.middleware.js';

const tunnelRoute: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const controller = new TunnelController(fastify);

  // Apply authentication to all routes
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireApprovedRequestDevice);

  fastify.get('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          status: { type: 'string', enum: ['online', 'offline', 'all'] },
        },
      },
    },
    handler: controller.list.bind(controller),
  });

  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'protocol', 'localAddress'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          protocol: { type: 'string', enum: ['http', 'tcp', 'udp'] },
          localAddress: { type: 'string', minLength: 1, maxLength: 255 },
          localHostname: { type: 'string', maxLength: 255 },
          clientId: { type: 'string' },
          ipWhitelist: { type: 'array', items: { type: 'string' } },
          metadata: { type: 'object' },
        },
      },
    },
    handler: controller.create.bind(controller),
  });

  fastify.get('/:tunnelId', {
    handler: controller.get.bind(controller),
  });

  fastify.put('/:tunnelId', {
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          localAddress: { type: 'string', minLength: 1, maxLength: 255 },
          localHostname: { type: 'string', maxLength: 255 },
          ipWhitelist: { type: 'array', items: { type: 'string' } },
          metadata: { type: 'object' },
        },
      },
    },
    handler: controller.update.bind(controller),
  });

  fastify.delete('/:tunnelId', {
    handler: controller.delete.bind(controller),
  });

  fastify.post('/:tunnelId/regenerate-token', {
    handler: controller.regenerateToken.bind(controller),
  });

  fastify.patch('/:tunnelId/enabled', {
    schema: {
      body: {
        type: 'object',
        required: ['enabled'],
        properties: {
          enabled: { type: 'boolean' },
        },
      },
    },
    handler: controller.setEnabled.bind(controller),
  });
};

export default tunnelRoute;
