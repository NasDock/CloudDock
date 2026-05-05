import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TrafficService } from './traffic.service.js';
import { success } from '../../utils/response.js';

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
}
