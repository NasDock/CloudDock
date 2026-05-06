import { FastifyInstance } from 'fastify';
import { prisma } from '../../plugins/database.plugin.js';
import { TRAFFIC_QUOTA } from '@cloud-dock/shared';
import type { UserTrafficStatistics, DirectTrafficReport, DirectTrafficStats } from '@cloud-dock/shared';

export class TrafficService {
  constructor(private fastify: FastifyInstance) {}

  async getUserTrafficStats(userId: string): Promise<UserTrafficStatistics> {
    const user = await prisma.user.findUnique({
      where: { userId },
      select: { plan: true },
    });

    if (!user) {
      throw { statusCode: 404, message: 'User not found' };
    }

    const quota = TRAFFIC_QUOTA[user.plan as keyof typeof TRAFFIC_QUOTA] ?? Infinity;

    const stats = await prisma.accessLog.aggregate({
      where: {
        tunnel: { userId },
      },
      _sum: {
        bytesIn: true,
        bytesOut: true,
      },
    });

    const bytesIn = Number(stats._sum.bytesIn || 0n);
    const bytesOut = Number(stats._sum.bytesOut || 0n);
    const quotaUsed = bytesIn + bytesOut;

    return {
      bytesIn,
      bytesOut,
      quota,
      quotaUsed,
    };
  }

  async reportDirectTraffic(userId: string, reports: DirectTrafficReport[]): Promise<void> {
    if (!reports.length) return;

    await prisma.directTrafficLog.createMany({
      data: reports.map((r) => ({
        userId,
        deviceId: r.deviceId,
        direction: r.direction,
        bytes: r.bytes,
        timestamp: r.timestamp ? new Date(r.timestamp) : new Date(),
      })),
    });
  }

  async getDirectTrafficStats(userId: string): Promise<DirectTrafficStats> {
    const stats = await prisma.directTrafficLog.aggregate({
      where: { userId },
      _sum: { bytes: true },
    });

    const inStats = await prisma.directTrafficLog.aggregate({
      where: { userId, direction: 'in' },
      _sum: { bytes: true },
    });

    const outStats = await prisma.directTrafficLog.aggregate({
      where: { userId, direction: 'out' },
      _sum: { bytes: true },
    });

    const bytesIn = Number(inStats._sum.bytes || 0);
    const bytesOut = Number(outStats._sum.bytes || 0);

    return {
      bytesIn,
      bytesOut,
      total: bytesIn + bytesOut,
    };
  }
}
