import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { TrafficController } from './traffic.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const trafficRoute: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const controller = new TrafficController(fastify);

  fastify.addHook('preHandler', authenticate);

  fastify.get('/stats', {
    handler: controller.getStats.bind(controller),
  });
};

export default trafficRoute;
