import { FastifyInstance } from 'fastify';
import { prisma } from '../../plugins/database.plugin.js';
import { TRAFFIC_QUOTA } from '@cloud-dock/shared';
import type { UserTrafficStatistics } from '@cloud-dock/shared';

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
}
