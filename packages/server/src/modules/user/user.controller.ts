import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { updateUserSchema } from '@cloud-dock/shared';
import { UserService } from './user.service.js';
import { success, error } from '../../utils/response.js';
import { ErrorCodes } from '@cloud-dock/shared';

export class UserController {
  private userService: UserService;

  constructor(private fastify: FastifyInstance) {
    this.userService = new UserService(fastify);
  }

  async getMe(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.userId;

    try {
      const user = await this.userService.getCurrentUser(userId);
      return success(reply, user);
    } catch (err: any) {
      if (err.statusCode === 404) {
        return error(reply, ErrorCodes.NOT_FOUND, err.message, 404);
      }
      throw err;
    }
  }

  async updateMe(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.userId;
    const body = updateUserSchema.parse(request.body);

    try {
      const user = await this.userService.updateCurrentUser(userId, body);
      return success(reply, user);
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
}
