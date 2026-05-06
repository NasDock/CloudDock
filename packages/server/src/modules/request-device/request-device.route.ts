import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '../../plugins/database.plugin.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { upsertRequestDeviceForUser } from '../../middleware/request-device.middleware.js';

const requestDeviceRoute: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // List request devices
  fastify.get('/', { preHandler: [authenticate] }, async (request) => {
    const userId = (request.user as any).userId || (request.user as any).sub;

    // Upsert the requesting device so mobile/mini clients register themselves
    await upsertRequestDeviceForUser(userId, request);

    const [devices, user] = await Promise.all([
      prisma.requestDevice.findMany({
        where: { userId },
        orderBy: { lastSeen: 'desc' },
      }),
      prisma.user.findUnique({
        where: { userId },
        select: { autoApproveNewRequestDevices: true },
      }),
    ]);

    return {
      success: true,
      data: {
        devices,
        settings: {
          autoApproveNewRequestDevices: user?.autoApproveNewRequestDevices ?? true,
        },
      },
    };
  });

  fastify.patch('/settings', { preHandler: [authenticate] }, async (request) => {
    const userId = (request.user as any).userId || (request.user as any).sub;
    const { autoApproveNewRequestDevices } = request.body as { autoApproveNewRequestDevices: boolean };

    const user = await prisma.user.update({
      where: { userId },
      data: { autoApproveNewRequestDevices },
      select: { autoApproveNewRequestDevices: true },
    });

    return {
      success: true,
      data: {
        autoApproveNewRequestDevices: user.autoApproveNewRequestDevices,
      },
    };
  });

  // Update status (approve/block)
  fastify.patch('/:deviceId', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = (request.user as any).userId || (request.user as any).sub;
    const { deviceId } = request.params as { deviceId: string };
    const { status } = request.body as { status: 'approved' | 'blocked' };

    const device = await prisma.requestDevice.findUnique({
      where: { userId_deviceId: { userId, deviceId } },
    });

    if (!device) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Device not found' },
      });
    }

    const updated = await prisma.requestDevice.update({
      where: { requestDeviceId: device.requestDeviceId },
      data: { status },
    });

    return { success: true, data: updated };
  });

  // Delete device
  fastify.delete('/:deviceId', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = (request.user as any).userId || (request.user as any).sub;
    const { deviceId } = request.params as { deviceId: string };

    const device = await prisma.requestDevice.findUnique({
      where: { userId_deviceId: { userId, deviceId } },
    });

    if (!device) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Device not found' },
      });
    }

    await prisma.requestDevice.delete({ where: { requestDeviceId: device.requestDeviceId } });
    return { success: true, data: { deviceId } };
  });
};

export default requestDeviceRoute;
