import { z } from 'zod';

// Auth schemas
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  username: z.string().min(1).max(100),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

// User schemas
export const updateUserSchema = z.object({
  username: z.string().min(1).max(100).optional(),
  oldPassword: z.string().optional(),
  newPassword: z.string().min(8).max(128).optional(),
});

// Tunnel schemas
export const createTunnelSchema = z.object({
  name: z.string().min(1).max(100),
  protocol: z.enum(['http', 'tcp', 'udp']),
  localAddress: z.string().min(1).max(255),
  localHostname: z.string().max(255).optional(),
  clientId: z.string().min(1).max(64).optional(),
  ipWhitelist: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateTunnelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  localAddress: z.string().min(1).max(255).optional(),
  localHostname: z.string().max(255).optional(),
  ipWhitelist: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Pagination schema
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Tunnel query schema
export const tunnelQuerySchema = paginationSchema.extend({
  status: z.enum(['online', 'offline', 'all']).optional(),
});

// Type exports
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateTunnelInput = z.infer<typeof createTunnelSchema>;
export type UpdateTunnelInput = z.infer<typeof updateTunnelSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type TunnelQueryInput = z.infer<typeof tunnelQuerySchema>;
