import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { TrafficController } from './traffic.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const trafficRoute: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const controller = new TrafficController(fastify);

  fastify.addHook('preHandler', authenticate);

  // Relay traffic stats
  fastify.get('/stats', {
    handler: controller.getStats.bind(controller),
  });

  // Report direct (P2P) traffic
  fastify.post('/direct', {
    handler: controller.reportDirect.bind(controller),
  });

  // Query direct (P2P) traffic stats
  fastify.get('/direct/stats', {
    handler: controller.getDirectStats.bind(controller),
  });
};

export default trafficRoute;
