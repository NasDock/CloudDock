import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { ClientService } from './client.service.js';

// Pairing storage: code -> { userId, userName, createdAt }
// Shared between HTTP routes and WS server via a singleton
export const pendingApprovals = new Map<string, {
  userId: string;
  userName: string;
  clientName?: string;
  createdAt: Date;
}>();

// Called by WS server to register a new pending pairing
export function registerPendingPairing(code: string, userId: string, userName: string) {
  pendingApprovals.set(code, { userId, userName, createdAt: new Date() });
  // Clean up after 10 minutes
  setTimeout(() => pendingApprovals.delete(code), 10 * 60 * 1000);
}

const clientRoute: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const service = new ClientService();

  // List user's clients
  fastify.get('/', async (request, reply) => {
    await request.jwtVerify();
    const userId = (request.user as any).userId || (request.user as any).sub;

    const result = await service.listClients(userId);
    return { success: true, data: result };
  });

  // Rename a client
  fastify.patch('/:clientId', async (request, reply) => {
    await request.jwtVerify();
    const userId = (request.user as any).userId || (request.user as any).sub;
    const { clientId } = request.params as { clientId: string };
    const { name } = request.body as { name: string };

    try {
      const result = await service.renameClient(userId, clientId, name);
      return { success: true, data: result };
    } catch (err: any) {
      if (err.statusCode) {
        return reply.status(err.statusCode).send({
          success: false,
          error: { code: 'ERROR', message: err.message },
        });
      }
      throw err;
    }
  });

  // Enable/disable a client (manual online/offline)
  fastify.patch('/:clientId/enabled', async (request, reply) => {
    await request.jwtVerify();
    const userId = (request.user as any).userId || (request.user as any).sub;
    const { clientId } = request.params as { clientId: string };
    const { enabled } = request.body as { enabled: boolean };

    try {
      const result = await service.setClientEnabled(userId, clientId, !!enabled);

      const { getWSServer } = await import('../../gateway/ws-server-holder.js');
      const wsServer = getWSServer();
      if (wsServer && !enabled) {
        await wsServer.disconnectClient(clientId);
      }

      return { success: true, data: result };
    } catch (err: any) {
      if (err.statusCode) {
        return reply.status(err.statusCode).send({
          success: false,
          error: { code: 'ERROR', message: err.message },
        });
      }
      throw err;
    }
  });

  // Delete a client
  fastify.delete('/:clientId', async (request, reply) => {
    await request.jwtVerify();
    const userId = (request.user as any).userId || (request.user as any).sub;
    const { clientId } = request.params as { clientId: string };

    try {
      const result = await service.deleteClient(userId, clientId);
      return { success: true, data: result };
    } catch (err: any) {
      if (err.statusCode) {
        return reply.status(err.statusCode).send({
          success: false,
          error: { code: 'ERROR', message: err.message },
        });
      }
      throw err;
    }
  });

  // List pending approvals (for web UI polling)
  // This returns pairings that need to be approved by the current user
  fastify.get('/pending', async (request, reply) => {
    await request.jwtVerify();
    const userId = (request.user as any).userId || (request.user as any).sub;

    // Import wsServer dynamically to avoid circular
    const { getWSServer } = await import('../../gateway/ws-server-holder.js');
    const wsServer = getWSServer();
    const pending = wsServer?.getPendingPairings() || [];

    // We don't know which user the pairing belongs to until approved
    // Web UI can show all pending (they'll be filtered by user context on approval)
    return {
      success: true,
      data: {
        pending: pending.map((p: any) => ({
          pairingCode: p.pairingCode,
          createdAt: p.createdAt,
        })),
      },
    };
  });

  // Ensure default client exists (used by web+nas-client bundled deployment)
  fastify.post('/default', async (request, reply) => {
    await request.jwtVerify();
    const userId = (request.user as any).userId || (request.user as any).sub;

    const result = await service.getOrCreateDefaultClient(userId);
    return { success: true, data: result };
  });

  // Approve a pairing
  fastify.post('/:pairingCode/approve', async (request, reply) => {
    await request.jwtVerify();
    const userId = (request.user as any).userId || (request.user as any).sub;
    const { pairingCode } = request.params as { pairingCode: string };
    const { clientName } = request.body as { clientName?: string };

    const { getWSServer } = await import('../../gateway/ws-server-holder.js');
    const wsServer = getWSServer();

    if (!wsServer) {
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'WS server not available' },
      });
    }

    const result = await wsServer.approvePairing(pairingCode, userId, clientName || 'NAS Client');

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'PAIRING_FAILED', message: result.error },
      });
    }

    return {
      success: true,
      data: { clientKey: result.clientKey },
    };
  });
};

export default clientRoute;
