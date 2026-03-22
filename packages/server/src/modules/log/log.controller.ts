import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { paginationSchema } from '@cloud-dock/shared';
import { LogService } from './log.service.js';
import { success, error } from '../../utils/response.js';
import { ErrorCodes } from '@cloud-dock/shared';

export class LogController {
  private logService: LogService;

  constructor(private fastify: FastifyInstance) {
    this.logService = new LogService(fastify);
  }

  async getTunnelLogs(
    request: FastifyRequest<{
      Params: { tunnelId: string };
      Querystring: { startTime?: string; endTime?: string; page?: string; limit?: string };
    }>,
    reply: FastifyReply
  ) {
    const userId = request.user.userId;
    const { tunnelId } = request.params;

    const parsedQuery = paginationSchema.parse(request.query);
    const startTime = request.query.startTime;
    const endTime = request.query.endTime;

    try {
      const queryParams: { page: number; limit: number; startTime?: string; endTime?: string } = {
        page: parsedQuery.page,
        limit: parsedQuery.limit,
      };
      if (startTime !== undefined) queryParams.startTime = startTime;
      if (endTime !== undefined) queryParams.endTime = endTime;

      const result = await this.logService.getTunnelLogs(userId, tunnelId, queryParams);
      return success(reply, result);
    } catch (err: any) {
      if (err.statusCode === 404) {
        return error(reply, ErrorCodes.NOT_FOUND, err.message, 404);
      }
      throw err;
    }
  }
}
