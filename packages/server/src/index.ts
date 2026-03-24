import { buildApp } from './app.js';
import { config } from './config/index.js';
import { registerWSServer } from './gateway/ws-server-holder.js';
import { WSServer } from './gateway/ws-server.js';

async function main() {
  const fastify = await buildApp();

  const wsServer = new WSServer(fastify);
  fastify.decorate('wsServer', wsServer);
  registerWSServer(wsServer);

  await fastify.listen({
    port: config.PORT,
    host: config.HOST,
  });

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    CloudDock Server                           ║
╠═══════════════════════════════════════════════════════════════╣
║  HTTP Server:  http://${config.HOST}:${config.PORT}                         
║  WebSocket:    ws://${config.HOST}:${config.PORT}/ws/device                   
║  API Docs:     http://localhost:${config.PORT}/docs                      
║  Server ID:    ${config.SERVER_ID.padEnd(45)}║
╚═══════════════════════════════════════════════════════════════╝
  `);

  console.log('[index] HTTP server listening, starting WS...');
  try {
    await wsServer.start(fastify.server);
    console.log('[index] WS server started');
  } catch (err) {
    console.error('[index] WS start error:', err);
  }

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down...`);
    wsServer.stop();
    await fastify.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
