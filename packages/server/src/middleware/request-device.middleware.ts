import { FastifyRequest, FastifyReply } from 'fastify';
import { createHash } from 'crypto';
import { prisma } from '../plugins/database.plugin.js';
import { error } from '../utils/response.js';
import { ErrorCodes } from '@cloud-dock/shared';

const HEADER_DEVICE_ID = 'x-request-device-id';
const HEADER_DEVICE_NAME = 'x-request-device-name';
const HEADER_DEVICE_PLATFORM = 'x-request-device-platform';

function deriveDeviceId(request: FastifyRequest): string {
  const ua = request.headers['user-agent']?.toString() || 'unknown';
  const ip = request.ip || 'unknown';
  const hash = createHash('sha256').update(`${ua}|${ip}`).digest('hex').slice(0, 16);
  return `rd_${hash}`;
}

export async function upsertRequestDeviceForUser(userId: string, request: FastifyRequest) {
  const headerDeviceId = request.headers[HEADER_DEVICE_ID] as string | undefined;
  const deviceId = (headerDeviceId && headerDeviceId.trim()) || deriveDeviceId(request);
  const name = (request.headers[HEADER_DEVICE_NAME] as string | undefined)?.trim() || null;
  const platform = (request.headers[HEADER_DEVICE_PLATFORM] as string | undefined)?.trim() || null;
  const userAgent = request.headers['user-agent']?.toString() || null;
  const lastIp = request.ip || null;

  let device = await prisma.requestDevice.findUnique({
    where: { userId_deviceId: { userId, deviceId } },
  });

  if (!device) {
    const existingCount = await prisma.requestDevice.count({ where: { userId } });
    const status = existingCount === 0 ? 'approved' : 'pending';
    device = await prisma.requestDevice.create({
      data: {
        userId,
        deviceId,
        name,
        platform,
        status,
        lastSeen: new Date(),
        lastIp,
        userAgent,
      },
    });
  } else {
    await prisma.requestDevice.update({
      where: { requestDeviceId: device.requestDeviceId },
      data: {
        lastSeen: new Date(),
        lastIp,
        userAgent,
        ...(name ? { name } : {}),
        ...(platform ? { platform } : {}),
      },
    });
  }

  return { device, deviceId };
}

export async function requireApprovedRequestDevice(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const user = request.user as any;
  const userId = user?.userId ?? user?.sub;
  if (!userId) return;

  const { device, deviceId } = await upsertRequestDeviceForUser(userId, request);

  if (device.status === 'blocked') {
    error(reply, ErrorCodes.DEVICE_BLOCKED, 'Device is blocked', 403, { deviceId, status: device.status });
    return;
  }

  if (device.status === 'pending') {
    error(reply, ErrorCodes.DEVICE_PENDING, 'Device pending approval', 403, { deviceId, status: device.status });
    return;
  }
}
