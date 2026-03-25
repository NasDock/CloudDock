import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '../../plugins/database.plugin.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const requestDeviceRoute: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // List request devices
  fastify.get('/', { preHandler: [authenticate] }, async (request) => {
    const userId = (request.user as any).userId || (request.user as any).sub;
    const devices = await prisma.requestDevice.findMany({
      where: { userId },
      orderBy: { lastSeen: 'desc' },
    });

    return { success: true, data: { devices } };
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
