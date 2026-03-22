import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import { config } from '../config/index.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string; // userId
      type: 'access' | 'refresh';
    };
    user: {
      userId: string;
      type: 'access' | 'refresh';
    };
  }
}

const jwtPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  await fastify.register(jwt, {
    secret: config.JWT_SECRET,
    sign: {
      expiresIn: config.JWT_EXPIRES_IN,
    },
  });
};

export default fp(jwtPlugin, {
  name: 'jwt',
});
