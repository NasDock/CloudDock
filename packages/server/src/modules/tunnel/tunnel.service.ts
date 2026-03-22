import { FastifyInstance } from 'fastify';
import { prisma } from '../../plugins/database.plugin.js';
import { CreateTunnelInput, UpdateTunnelInput, TunnelQueryInput, generateTunnelId, generateAccessToken, TUNNEL_LIMITS } from '@cloud-dock/shared';
import type { Tunnel, Device, User } from '@prisma/client';

type TunnelWithUser = Tunnel & { user: Pick<User, 'userId'> };

export class TunnelService {
  constructor(private fastify: FastifyInstance) {}

  async listTunnels(userId: string, query: TunnelQueryInput) {
    const { page = 1, limit = 20, status } = query;

    const where: { userId: string; status?: 'online' | 'offline' } = { userId };
    if (status && status !== 'all') {
      where.status = status;
    }

    const [tunnels, total] = await Promise.all([
      prisma.tunnel.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          tunnelId: true,
          clientId: true,
          name: true,
          protocol: true,
          localAddress: true,
          enabled: true,
          status: true,
          accessToken: true,
          publicPath: true,
          createdAt: true,
          lastHeartbeat: true,
        },
      }),
      prisma.tunnel.count({ where }),
    ]);

    return {
      tunnels: tunnels.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
        lastHeartbeat: t.lastHeartbeat?.toISOString() || null,
      })),
      pagination: {
        page,
        limit,
        total,
      },
    };
  }

  async createTunnel(userId: string, input: CreateTunnelInput) {
    // Check tunnel limit based on plan
    const user = await prisma.user.findUnique({
      where: { userId },
      select: { plan: true, username: true },
    });

    if (!user) {
      throw { statusCode: 404, message: 'User not found' };
    }

    const tunnelCount = await prisma.tunnel.count({ where: { userId } });
    const limit = TUNNEL_LIMITS[user.plan as keyof typeof TUNNEL_LIMITS];

    if (tunnelCount >= limit) {
      throw {
        statusCode: 403,
        message: `Tunnel limit reached. Your plan allows ${limit} tunnels.`,
      };
    }

    const tunnelId = generateTunnelId();
    const accessToken = generateAccessToken();
    const slug = input.name.toLowerCase().replace(/\s+/g, '-');
    const publicPath = `/${user.username}/${slug}/`;

    let clientId: string | null = null;
    if (input.clientId) {
      const client = await prisma.client.findFirst({
        where: { userId, clientId: input.clientId, enabled: true },
        select: { clientId: true },
      });
      if (!client) {
        throw { statusCode: 400, message: 'Client not available' };
      }
      clientId = client.clientId;
    } else {
      const defaultClient = await prisma.client.findFirst({
        where: { userId, isDefault: true, enabled: true },
        select: { clientId: true },
      });
      clientId = defaultClient?.clientId ?? null;
    }

    const tunnel = await prisma.tunnel.create({
      data: {
        tunnelId,
        userId,
        clientId,
        name: input.name,
        protocol: input.protocol,
        localAddress: input.localAddress,
        localHostname: input.localHostname ?? null,
        enabled: true,
        accessToken,
        publicPath,
        ipWhitelist: JSON.stringify(input.ipWhitelist || []),
        metadata: input.metadata as any,
      },
    });

    return {
      tunnelId: tunnel.tunnelId,
      name: tunnel.name,
      protocol: tunnel.protocol,
      localAddress: tunnel.localAddress,
      status: tunnel.status,
      enabled: tunnel.enabled,
      accessToken: tunnel.accessToken,
      publicPath: tunnel.publicPath,
      createdAt: tunnel.createdAt.toISOString(),
    };
  }

  async getTunnel(userId: string, tunnelId: string) {
    const tunnel = await prisma.tunnel.findFirst({
      where: { tunnelId, userId },
    });

    if (!tunnel) {
      throw { statusCode: 404, message: 'Tunnel not found' };
    }

    // Calculate statistics
    const stats = await prisma.accessLog.aggregate({
      where: { tunnelId },
      _count: { logId: true },
      _sum: { bytesIn: true, bytesOut: true },
    });

    return {
      tunnelId: tunnel.tunnelId,
      name: tunnel.name,
      protocol: tunnel.protocol,
      localAddress: tunnel.localAddress,
      status: tunnel.status,
      publicPath: tunnel.publicPath,
      accessToken: tunnel.accessToken,
      enabled: tunnel.enabled,
      statistics: {
        totalRequests: stats._count.logId,
        bytesIn: Number(stats._sum.bytesIn || 0n),
        bytesOut: Number(stats._sum.bytesOut || 0n),
      },
      createdAt: tunnel.createdAt.toISOString(),
      lastHeartbeat: tunnel.lastHeartbeat?.toISOString() || null,
    };
  }

  async updateTunnel(userId: string, tunnelId: string, input: UpdateTunnelInput) {
    const tunnel = await prisma.tunnel.findFirst({
      where: { tunnelId, userId },
    });

    if (!tunnel) {
      throw { statusCode: 404, message: 'Tunnel not found' };
    }

    if (tunnel.status === 'online') {
      throw { statusCode: 400, message: 'Cannot update tunnel while it is online' };
    }

    const updateData: any = {};
    if (input.name !== undefined) {
      updateData.name = input.name;
      const user = await prisma.user.findUnique({
        where: { userId },
        select: { username: true },
      });
      if (user) {
        const slug = input.name.toLowerCase().replace(/\s+/g, '-');
        updateData.publicPath = `/${user.username}/${slug}/`;
      }
    }
    if (input.localAddress !== undefined) updateData.localAddress = input.localAddress;
    if (input.localHostname !== undefined) updateData.localHostname = input.localHostname;
    if (input.ipWhitelist !== undefined) updateData.ipWhitelist = JSON.stringify(input.ipWhitelist);
    if (input.metadata !== undefined) updateData.metadata = input.metadata;

    const updated = await prisma.tunnel.update({
      where: { tunnelId },
      data: updateData,
    });

    return {
      tunnelId: updated.tunnelId,
      name: updated.name,
      protocol: updated.protocol,
      localAddress: updated.localAddress,
      status: updated.status,
      publicPath: updated.publicPath,
      enabled: updated.enabled,
      createdAt: updated.createdAt.toISOString(),
      lastHeartbeat: updated.lastHeartbeat?.toISOString() || null,
    };
  }

  async setTunnelEnabled(userId: string, tunnelId: string, enabled: boolean) {
    const tunnel = await prisma.tunnel.findFirst({
      where: { tunnelId, userId },
    });

    if (!tunnel) {
      throw { statusCode: 404, message: 'Tunnel not found' };
    }

    const updated = await prisma.tunnel.update({
      where: { tunnelId },
      data: {
        enabled,
        status: enabled ? tunnel.status : 'offline',
      },
    });

    return {
      tunnelId: updated.tunnelId,
      enabled: updated.enabled,
      status: updated.status,
    };
  }

  async deleteTunnel(userId: string, tunnelId: string) {
    const tunnel = await prisma.tunnel.findFirst({
      where: { tunnelId, userId },
    });

    if (!tunnel) {
      throw { statusCode: 404, message: 'Tunnel not found' };
    }

    await prisma.tunnel.delete({
      where: { tunnelId },
    });

    // Also notify connected devices via Redis pub/sub if available
    if (this.fastify.redisAvailable) { await this.fastify.redis.publish('tunnel:deleted', JSON.stringify({ tunnelId })).catch(() => {}); }
  }

  async regenerateToken(userId: string, tunnelId: string) {
    const tunnel = await prisma.tunnel.findFirst({
      where: { tunnelId, userId },
    });

    if (!tunnel) {
      throw { statusCode: 404, message: 'Tunnel not found' };
    }

    const newAccessToken = generateAccessToken();

    await prisma.tunnel.update({
      where: { tunnelId },
      data: { accessToken: newAccessToken },
    });

    return { accessToken: newAccessToken };
  }

  async updateTunnelStatus(tunnelId: string, status: 'online' | 'offline') {
    await prisma.tunnel.update({
      where: { tunnelId },
      data: {
        status,
        lastHeartbeat: new Date(),
      },
    });
  }
}
