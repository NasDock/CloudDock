import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { UserController } from './user.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const userRoute: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const controller = new UserController(fastify);

  fastify.get('/me', {
    preHandler: [authenticate],
    handler: controller.getMe.bind(controller),
  });

  fastify.put('/me', {
    preHandler: [authenticate],
    schema: {
      body: {
        type: 'object',
        properties: {
          username: { type: 'string', minLength: 1, maxLength: 100 },
          oldPassword: { type: 'string' },
          newPassword: { type: 'string', minLength: 8, maxLength: 128 },
        },
      },
    },
    handler: controller.updateMe.bind(controller),
  });
};

export default userRoute;
