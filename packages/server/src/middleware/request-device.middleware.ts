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

function parseUserAgent(ua: string): { name: string | null; platform: string | null } {
  if (!ua) return { name: null, platform: null };

  let platform: string | null = null;
  if (/iPhone|iPad|iPod/i.test(ua)) platform = 'iOS';
  else if (/Android/i.test(ua)) platform = 'Android';
  else if (/Windows NT/i.test(ua)) platform = 'Windows';
  else if (/Mac OS X/i.test(ua)) platform = 'macOS';
  else if (/Linux/i.test(ua)) platform = 'Linux';

  let name: string | null = null;
  if (/MicroMessenger/i.test(ua)) name = '微信';
  else if (/DingTalk/i.test(ua)) name = '钉钉';
  else if (/EdgiOS|EdgA/i.test(ua)) name = `Edge (${platform || '未知'})`;
  else if (/Chrome/i.test(ua) && !/Edg|OPR/i.test(ua)) name = `Chrome (${platform || '未知'})`;
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) name = `Safari (${platform || '未知'})`;
  else if (/Firefox/i.test(ua)) name = `Firefox (${platform || '未知'})`;
  else if (platform) name = platform;

  return { name, platform };
}

export async function upsertRequestDeviceForUser(userId: string, request: FastifyRequest) {
  const headerDeviceId = request.headers[HEADER_DEVICE_ID] as string | undefined;
  const deviceId = (headerDeviceId && headerDeviceId.trim()) || deriveDeviceId(request);
  const headerName = (request.headers[HEADER_DEVICE_NAME] as string | undefined)?.trim() || null;
  const headerPlatform = (request.headers[HEADER_DEVICE_PLATFORM] as string | undefined)?.trim() || null;
  const userAgent = request.headers['user-agent']?.toString() || null;
  const lastIp = request.ip || null;

  // Fallback: derive name/platform from User-Agent when headers are absent
  const uaParsed = userAgent ? parseUserAgent(userAgent) : { name: null, platform: null };
  const name = headerName || uaParsed.name;
  const platform = headerPlatform || uaParsed.platform;

  let device = await prisma.requestDevice.findUnique({
    where: { userId_deviceId: { userId, deviceId } },
  });

  if (!device) {
    const user = await prisma.user.findUnique({
      where: { userId },
      select: { autoApproveNewRequestDevices: true },
    });
    const status = user?.autoApproveNewRequestDevices === false ? 'pending' : 'approved';
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
