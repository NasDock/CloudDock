import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { LogController } from './log.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const logRoute: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const controller = new LogController(fastify);

  // Apply authentication to all routes
  fastify.addHook('preHandler', authenticate);

  fastify.get('/tunnels/:tunnelId/logs', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          startTime: { type: 'string', format: 'date-time' },
          endTime: { type: 'string', format: 'date-time' },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
        },
      },
    },
    handler: controller.getTunnelLogs.bind(controller),
  });
};

export default logRoute;
