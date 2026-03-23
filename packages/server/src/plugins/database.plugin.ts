import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import prismaPkg from '@prisma/client';

const { PrismaClient, Prisma } = prismaPkg as typeof import('@prisma/client');

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

// Singleton prisma instance for use outside Fastify plugin context
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
});

const prismaPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  await prisma.$connect();
  fastify.decorate('prisma', prisma);
  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
};

export default prismaPlugin;
