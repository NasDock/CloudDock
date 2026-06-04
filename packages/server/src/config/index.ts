import { z } from 'zod';
import dotenv from 'dotenv';
import { resolve } from 'path';

// Load server.env file if it exists (for local development or pm2 deployments)
const envPath = resolve(process.cwd(), 'server.env');
dotenv.config({ path: envPath });

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('24h'),
  REFRESH_TOKEN_EXPIRES_IN_DAYS: z.coerce.number().default(30),
  WS_HEARTBEAT_INTERVAL_MS: z.coerce.number().default(30_000),
  WS_HEARTBEAT_TIMEOUT_MS: z.coerce.number().default(10_000),
  CORS_ORIGIN: z.string().default('*'),
  SERVER_ID: z.string().default('server-1'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  // TURN server configuration (optional but recommended for mobile cellular networks)
  CLOUD_DOCK_TURN_URLS: z.string().optional(),
  CLOUD_DOCK_TURN_SECRET: z.string().optional(),
});

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const config = parsed.data;

export type Config = typeof config;
