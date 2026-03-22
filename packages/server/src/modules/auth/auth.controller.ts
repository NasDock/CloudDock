import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { registerSchema, loginSchema, refreshTokenSchema } from '@cloud-dock/shared';
import { AuthService } from './auth.service.js';
import { success, successMessage, error } from '../../utils/response.js';
import { ErrorCodes } from '@cloud-dock/shared';

export class AuthController {
  private authService: AuthService;

  constructor(private fastify: FastifyInstance) {
    this.authService = new AuthService(fastify);
  }

  async register(request: FastifyRequest, reply: FastifyReply) {
    const body = registerSchema.parse(request.body);

    try {
      const result = await this.authService.register(body);
      return success(reply, result, 201);
    } catch (err: any) {
      if (err.statusCode === 409) {
        return error(reply, ErrorCodes.CONFLICT, err.message, 409);
      }
      throw err;
    }
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    const body = loginSchema.parse(request.body);

    try {
      const result = await this.authService.login(body);
      return success(reply, result);
    } catch (err: any) {
      if (err.statusCode === 401) {
        return error(reply, ErrorCodes.UNAUTHORIZED, err.message, 401);
      }
      throw err;
    }
  }

  async refresh(request: FastifyRequest, reply: FastifyReply) {
    const body = refreshTokenSchema.parse(request.body);

    try {
      const result = await this.authService.refresh(body.refreshToken);
      return success(reply, result);
    } catch (err: any) {
      if (err.statusCode === 401) {
        return error(reply, ErrorCodes.UNAUTHORIZED, err.message, 401);
      }
      throw err;
    }
  }

  async logout(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.userId;
    await this.authService.logout(userId);
    return successMessage(reply, 'Logged out successfully');
  }
}
