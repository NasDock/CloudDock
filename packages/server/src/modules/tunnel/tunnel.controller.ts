import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createTunnelSchema, updateTunnelSchema, tunnelQuerySchema } from '@cloud-dock/shared';
import { TunnelService } from './tunnel.service.js';
import { success, successMessage, error } from '../../utils/response.js';
import { ErrorCodes } from '@cloud-dock/shared';
import { prisma } from '../../plugins/database.plugin.js';
import { getWSServer } from '../../gateway/ws-server-holder.js';
import { connectionPool } from '../../gateway/connection-pool.js';

export class TunnelController {
  private tunnelService: TunnelService;

  constructor(private fastify: FastifyInstance) {
    this.tunnelService = new TunnelService(fastify);
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.userId;
    const query = tunnelQuerySchema.parse(request.query);

    const result = await this.tunnelService.listTunnels(userId, query);
    return success(reply, result);
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.userId;
    const body = createTunnelSchema.parse(request.body);

    try {
      const result = await this.tunnelService.createTunnel(userId, body);
      const wsServer = getWSServer();
      if (wsServer) {
        const tunnel = await prisma.tunnel.findUnique({ where: { tunnelId: result.tunnelId } });
        if (tunnel) {
          await wsServer.broadcastTunnelUpdate(userId, tunnel);
        }
      }
      return success(reply, result, 201);
    } catch (err: any) {
      if (err.statusCode === 404) {
        return error(reply, ErrorCodes.NOT_FOUND, err.message, 404);
      }
      if (err.statusCode === 403) {
        return error(reply, ErrorCodes.FORBIDDEN, err.message, 403);
      }
      throw err;
    }
  }

  async get(request: FastifyRequest<{ Params: { tunnelId: string } }>, reply: FastifyReply) {
    const userId = request.user.userId;
    const { tunnelId } = request.params;

    try {
      const result = await this.tunnelService.getTunnel(userId, tunnelId);
      return success(reply, result);
    } catch (err: any) {
      if (err.statusCode === 404) {
        return error(reply, ErrorCodes.NOT_FOUND, err.message, 404);
      }
      throw err;
    }
  }

  async update(request: FastifyRequest<{ Params: { tunnelId: string } }>, reply: FastifyReply) {
    const userId = request.user.userId;
    const { tunnelId } = request.params;
    const body = updateTunnelSchema.parse(request.body);

    try {
      const result = await this.tunnelService.updateTunnel(userId, tunnelId, body);
      const wsServer = getWSServer();
      if (wsServer) {
        const tunnel = await prisma.tunnel.findUnique({ where: { tunnelId } });
        if (tunnel) {
          await wsServer.broadcastTunnelUpdate(userId, tunnel);
        }
      }
      return success(reply, result);
    } catch (err: any) {
      if (err.statusCode === 404) {
        return error(reply, ErrorCodes.NOT_FOUND, err.message, 404);
      }
      if (err.statusCode === 400) {
        return error(reply, ErrorCodes.VALIDATION_ERROR, err.message, 400);
      }
      throw err;
    }
  }

  async delete(request: FastifyRequest<{ Params: { tunnelId: string } }>, reply: FastifyReply) {
    const userId = request.user.userId;
    const { tunnelId } = request.params;

    try {
      await this.tunnelService.deleteTunnel(userId, tunnelId);
      const wsServer = getWSServer();
      if (wsServer) {
        await wsServer.broadcastTunnelDeleted(userId, tunnelId);
      }
      return successMessage(reply, 'Tunnel deleted successfully');
    } catch (err: any) {
      if (err.statusCode === 404) {
        return error(reply, ErrorCodes.NOT_FOUND, err.message, 404);
      }
      throw err;
    }
  }

  async setEnabled(
    request: FastifyRequest<{ Params: { tunnelId: string }; Body: { enabled: boolean } }>,
    reply: FastifyReply
  ) {
    const userId = request.user.userId;
    const { tunnelId } = request.params;
    const { enabled } = request.body;

    try {
      const result = await this.tunnelService.setTunnelEnabled(userId, tunnelId, !!enabled);

      const wsServer = getWSServer();
      if (wsServer) {
        const tunnel = await prisma.tunnel.findUnique({ where: { tunnelId } });
        if (tunnel) {
          await wsServer.broadcastTunnelUpdate(userId, tunnel);
        }
      }
      if (!enabled) {
        connectionPool.unregisterTunnel(tunnelId);
      }

      return success(reply, result);
    } catch (err: any) {
      if (err.statusCode === 404) {
        return error(reply, ErrorCodes.NOT_FOUND, err.message, 404);
      }
      throw err;
    }
  }

  async regenerateToken(
    request: FastifyRequest<{ Params: { tunnelId: string } }>,
    reply: FastifyReply
  ) {
    const userId = request.user.userId;
    const { tunnelId } = request.params;

    try {
      const result = await this.tunnelService.regenerateToken(userId, tunnelId);
      return success(reply, result);
    } catch (err: any) {
      if (err.statusCode === 404) {
        return error(reply, ErrorCodes.NOT_FOUND, err.message, 404);
      }
      throw err;
    }
  }
}
