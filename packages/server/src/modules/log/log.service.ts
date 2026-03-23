import { generateLogId, PaginationInput } from '@cloud-dock/shared';
import { FastifyInstance } from 'fastify';
import { prisma } from '../../plugins/database.plugin.js';

export class LogService {
  constructor(private fastify: FastifyInstance) {}

  async getTunnelLogs(
    userId: string,
    tunnelId: string,
    query: { startTime?: string; endTime?: string } & PaginationInput
  ) {
    // First verify user owns this tunnel
    const tunnel = await prisma.tunnel.findFirst({
      where: { tunnelId, userId },
    });

    if (!tunnel) {
      throw { statusCode: 404, message: 'Tunnel not found' };
    }

    const { page = 1, limit = 50, startTime, endTime } = query;

    const where: { tunnelId: string; timestamp?: { gte?: Date; lte?: Date } } = { tunnelId };

    if (startTime || endTime) {
      where.timestamp = {};
      if (startTime) {
        where.timestamp.gte = new Date(startTime);
      }
      if (endTime) {
        where.timestamp.lte = new Date(endTime);
      }
    }

    const [logs, total] = await Promise.all([
      prisma.accessLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { timestamp: 'desc' },
        select: {
          logId: true,
          timestamp: true,
          clientIp: true,
          method: true,
          path: true,
          statusCode: true,
          responseTime: true,
        },
      }),
      prisma.accessLog.count({ where }),
    ]);

    return {
      logs: logs.map((log: any) => ({
        logId: log.logId,
        timestamp: log.timestamp.toISOString(),
        clientIp: log.clientIp,
        method: log.method,
        path: log.path,
        statusCode: log.statusCode,
        responseTime: log.responseTime,
      })),
      pagination: {
        page,
        limit,
        total,
      },
    };
  }

  async createLog(data: {
    tunnelId: string;
    clientIp: string;
    method: string;
    path: string;
    statusCode: number;
    responseTime: number;
    bytesIn?: number;
    bytesOut?: number;
  }) {
    await prisma.accessLog.create({
      data: {
        logId: generateLogId(),
        tunnelId: data.tunnelId,
        clientIp: data.clientIp,
        method: data.method,
        path: data.path,
        statusCode: data.statusCode,
        responseTime: data.responseTime,
        bytesIn: data.bytesIn ?? 0,
        bytesOut: data.bytesOut ?? 0,
      },
    });
  }
}
