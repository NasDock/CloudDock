import Fastify, { FastifyInstance } from 'fastify';
import { config } from './config/index.js';
import { errorHandler } from './middleware/error.middleware.js';
import { WSServer } from './gateway/ws-server.js';
import { registerWSServer } from './gateway/ws-server-holder.js';
import { Server } from 'http';

// Plugins
import prismaPlugin from './plugins/database.plugin.js';
import redisPlugin from './plugins/redis.plugin.js';
import jwtPlugin from './plugins/jwt.plugin.js';
import corsPlugin from './plugins/cors.plugin.js';
import swaggerPlugin from './plugins/swagger.plugin.js';

// Routes
import authRoute from './modules/auth/auth.route.js';
import userRoute from './modules/user/user.route.js';
import tunnelRoute from './modules/tunnel/tunnel.route.js';
import clientRoute from './modules/client/client.route.js';
import logRoute from './modules/log/log.route.js';

// Extend FastifyInstance
declare module 'fastify' {
  interface FastifyInstance {
    wsServer: WSServer;
  }
}

export async function buildApp(): Promise<FastifyInstance> {
  const loggerConfig: any = {
    level: config.LOG_LEVEL,
  };

  if (config.NODE_ENV === 'development') {
    loggerConfig.transport = {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    };
  }

  const fastify = Fastify({
    logger: loggerConfig,
  });

  fastify.setErrorHandler(errorHandler);
  fastify.decorate('env', config);

  // Register plugins
  await fastify.register(prismaPlugin);
  await fastify.register(redisPlugin);
  await fastify.register(jwtPlugin);
  await fastify.register(corsPlugin);
  await fastify.register(swaggerPlugin);

  // Health check endpoint
  fastify.get('/health', async () => {
    const { connectionPool } = await import('./gateway/connection-pool.js');
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      connections: connectionPool.size(),
    };
  });

  // Register routes with prefix
  await fastify.register(authRoute, { prefix: '/api/auth' });
  await fastify.register(userRoute, { prefix: '/api/users' });
  await fastify.register(tunnelRoute, { prefix: '/api/tunnels' });
  await fastify.register(clientRoute, { prefix: '/api/clients' });
  await fastify.register(logRoute, { prefix: '/api' });

  // Tunnel routing handler - catches requests like /{username}/{tunnelName}/*
  fastify.addHook('preHandler', async (request, reply) => {
    if (!['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return;
    }

    const url = request.url;

    if (url.startsWith('/api') || url.startsWith('/ws')) {
      return;
    }

    if (/^\/[^/]+\/[^/]+\/?/.test(url)) {
      const { HttpProxy } = await import('./gateway/http-proxy.js');
      const messageHandler = fastify.wsServer.getMessageHandler();
      const tunnelManager = messageHandler.getTunnelManager();
      const proxy = new HttpProxy(request, reply, tunnelManager, fastify);
      await proxy.handleRequest();
      return;
    }
  });

  // Note: WS server is started in index.ts after listen() returns

  return fastify;
}
