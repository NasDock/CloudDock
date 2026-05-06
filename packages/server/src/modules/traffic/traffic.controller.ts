import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TrafficService } from './traffic.service.js';
import { success } from '../../utils/response.js';
import type { DirectTrafficReport } from '@cloud-dock/shared';

export class TrafficController {
  private trafficService: TrafficService;

  constructor(private fastify: FastifyInstance) {
    this.trafficService = new TrafficService(fastify);
  }

  async getStats(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.userId;
    const result = await this.trafficService.getUserTrafficStats(userId);
    return success(reply, result);
  }

  async reportDirect(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.userId;
    const { reports } = request.body as { reports: DirectTrafficReport[] };
    await this.trafficService.reportDirectTraffic(userId, reports);
    return success(reply, { recorded: reports.length });
  }

  async getDirectStats(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.userId;
    const result = await this.trafficService.getDirectTrafficStats(userId);
    return success(reply, result);
  }
}
