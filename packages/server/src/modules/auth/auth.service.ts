import { FastifyInstance } from 'fastify';
import { prisma } from '../../plugins/database.plugin.js';
import { RegisterInput, LoginInput } from '@cloud-dock/shared';
import { generateUserId, generateRefreshTokenId } from '@cloud-dock/shared';
import bcrypt from 'bcrypt';
import { config } from '../../config/index.js';

const BCRYPT_ROUNDS = 12;

export class AuthService {
  constructor(private fastify: FastifyInstance) {}

  async register(input: RegisterInput) {
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: input.email }, { username: input.username }],
      },
      select: { email: true, username: true },
    });

    if (existingUser) {
      if (existingUser.email === input.email) {
        throw { statusCode: 409, message: 'Email already registered' };
      }
      throw { statusCode: 409, message: 'Username already registered' };
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        userId: generateUserId(),
        email: input.email,
        username: input.username,
        passwordHash,
      },
      select: {
        userId: true,
        email: true,
        username: true,
        createdAt: true,
      },
    });

    return {
      userId: user.userId,
      email: user.email,
      username: user.username,
    };
  }

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      throw { statusCode: 401, message: 'Invalid email or password' };
    }

    const passwordValid = await bcrypt.compare(input.password, user.passwordHash);

    if (!passwordValid) {
      throw { statusCode: 401, message: 'Invalid email or password' };
    }

    const accessToken = this.fastify.jwt.sign({
      sub: user.userId,
      type: 'access',
    });

    const refreshTokenId = generateRefreshTokenId();
    const refreshToken = this.fastify.jwt.sign(
      {
        sub: user.userId,
        type: 'refresh',
        jti: refreshTokenId,
      } as any,
      { expiresIn: `${config.REFRESH_TOKEN_EXPIRES_IN_DAYS}d` }
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + config.REFRESH_TOKEN_EXPIRES_IN_DAYS);

    await prisma.refreshToken.create({
      data: {
        tokenId: refreshTokenId,
        userId: user.userId,
        expiresAt,
      },
    });

    // Store in Redis if available (for quick revocation)
    if (this.fastify.redisAvailable) {
      try {
        await this.fastify.redis.setex(
          `refresh_token:${refreshTokenId}`,
          config.REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60,
          user.userId
        );
      } catch (err) {
        this.fastify.log.warn({ err }, 'Redis store failed, continuing with DB only');
      }
    }

    return {
      accessToken,
      refreshToken,
      expiresIn: 86400,
    };
  }

  async refresh(refreshToken: string) {
    let decoded: { sub: string; type: string; jti: string };
    try {
      decoded = this.fastify.jwt.verify(refreshToken) as { sub: string; type: string; jti: string };
    } catch {
      throw { statusCode: 401, message: 'Invalid or expired refresh token' };
    }

    if (decoded.type !== 'refresh') {
      throw { statusCode: 401, message: 'Invalid token type' };
    }

    // Check Redis revocation cache first
    if (this.fastify.redisAvailable) {
      try {
        const revoked = await this.fastify.redis.get(`revoked_token:${decoded.jti}`);
        if (revoked) {
          throw { statusCode: 401, message: 'Refresh token has been revoked' };
        }
      } catch (err: any) {
        if (err.statusCode) throw err;
        this.fastify.log.warn({ err }, 'Redis revocation check failed, falling back to DB');
      }
    }

    // Always check database as source of truth
    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenId: decoded.jti },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw { statusCode: 401, message: 'Refresh token expired or revoked' };
    }

    const accessToken = this.fastify.jwt.sign({
      sub: decoded.sub,
      type: 'access',
    });

    return {
      accessToken,
      expiresIn: 86400,
    };
  }

  async logout(userId: string): Promise<void> {
    const tokens = await prisma.refreshToken.findMany({
      where: { userId },
    });

    // Revoke in Redis if available
    if (this.fastify.redisAvailable && tokens.length > 0) {
      try {
        const pipeline = this.fastify.redis.pipeline();
        for (const token of tokens) {
          pipeline.setex(`revoked_token:${token.tokenId}`, 86400, '1');
        }
        pipeline.del(...tokens.map((t: any) => `refresh_token:${t.tokenId}`));
        await pipeline.exec();
      } catch (err) {
        this.fastify.log.warn({ err }, 'Redis revocation batch failed, continuing with DB only');
      }
    }

    await prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  async revokeRefreshToken(tokenId: string): Promise<void> {
    const token = await prisma.refreshToken.findUnique({
      where: { tokenId },
    });

    if (token) {
      if (this.fastify.redisAvailable) {
        try {
          await this.fastify.redis.setex(`revoked_token:${tokenId}`, 86400, '1');
        } catch (err) {
          this.fastify.log.warn({ err }, 'Redis revoke failed, continuing with DB only');
        }
      }
      await prisma.refreshToken.delete({
        where: { tokenId },
      });
    }
  }
}
