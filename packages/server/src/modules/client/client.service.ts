import { nanoid } from 'nanoid';
import { prisma } from '../../plugins/database.plugin.js';

export class ClientService {
  private generateClientKey(): string {
    return `ck_${nanoid(32)}`;
  }

  async listClients(userId: string) {
    const clients = await prisma.client.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    return {
      clients: clients.map((c: any) => ({
        clientId: c.clientId,
        name: c.name,
        status: c.status,
        enabled: c.enabled,
        lastSeen: c.lastSeen?.toISOString() || null,
        createdAt: c.createdAt.toISOString(),
      })),
    };
  }

  async renameClient(userId: string, clientId: string, name: string) {
    const client = await prisma.client.findUnique({ where: { clientId } });
    if (!client || client.userId !== userId) {
      throw { statusCode: 404, message: 'Client not found' };
    }

    const updated = await prisma.client.update({
      where: { clientId },
      data: { name },
    });

    return {
      clientId: updated.clientId,
      name: updated.name,
    };
  }

  async deleteClient(userId: string, clientId: string) {
    const client = await prisma.client.findUnique({ where: { clientId } });
    if (!client || client.userId !== userId) {
      throw { statusCode: 404, message: 'Client not found' };
    }

    await prisma.client.delete({ where: { clientId } });
    return { success: true };
  }

  async getOrCreateDefaultClient(userId: string) {
    const existing = await prisma.client.findFirst({
      where: { userId, isDefault: true },
    });

    if (existing) {
      return {
        clientId: existing.clientId,
        clientKey: existing.clientKey,
        name: existing.name,
        status: existing.status,
        enabled: existing.enabled,
        isDefault: existing.isDefault,
      };
    }

    const clientKey = this.generateClientKey();
    const created = await prisma.client.create({
      data: {
        clientKey,
        userId,
        name: 'Default NAS',
        isDefault: true,
      },
    });

    return {
      clientId: created.clientId,
      clientKey: created.clientKey,
      name: created.name,
      status: created.status,
      enabled: created.enabled,
      isDefault: created.isDefault,
    };
  }

  async setClientEnabled(userId: string, clientId: string, enabled: boolean) {
    const client = await prisma.client.findUnique({ where: { clientId } });
    if (!client || client.userId !== userId) {
      throw { statusCode: 404, message: 'Client not found' };
    }

    const updated = await prisma.client.update({
      where: { clientId },
      data: { enabled },
    });

    return {
      clientId: updated.clientId,
      enabled: updated.enabled,
      status: updated.status,
    };
  }
}
