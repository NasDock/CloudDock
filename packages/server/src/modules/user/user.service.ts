import { FastifyInstance } from 'fastify';
import { prisma } from '../../plugins/database.plugin.js';
import { UpdateUserInput } from '@cloud-dock/shared';
import bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

export class UserService {
  constructor(private fastify: FastifyInstance) {}

  async getCurrentUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { userId },
      select: {
        userId: true,
        email: true,
        username: true,
        plan: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw { statusCode: 404, message: 'User not found' };
    }

    return {
      userId: user.userId,
      email: user.email,
      username: user.username,
      plan: user.plan,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async updateCurrentUser(userId: string, input: UpdateUserInput) {
    const user = await prisma.user.findUnique({
      where: { userId },
    });

    if (!user) {
      throw { statusCode: 404, message: 'User not found' };
    }

    const updateData: { username?: string; passwordHash?: string } = {};

    if (input.username) {
      updateData.username = input.username;
    }

    if (input.newPassword) {
      // Verify old password
      if (!input.oldPassword) {
        throw { statusCode: 400, message: 'Old password is required' };
      }

      const passwordValid = await bcrypt.compare(input.oldPassword, user.passwordHash);
      if (!passwordValid) {
        throw { statusCode: 400, message: 'Current password is incorrect' };
      }

      updateData.passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
    }

    const updated = await prisma.user.update({
      where: { userId },
      data: updateData,
      select: {
        userId: true,
        email: true,
        username: true,
        plan: true,
        createdAt: true,
      },
    });

    return {
      userId: updated.userId,
      email: updated.email,
      username: updated.username,
      plan: updated.plan,
      createdAt: updated.createdAt.toISOString(),
    };
  }
}
