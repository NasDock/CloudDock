// Shared constants
export const ID_PREFIXES = {
  USER: 'usr_',
  DEVICE: 'dev_',
  TUNNEL: 'tnl_',
  SESSION: 'ses_',
  LOG: 'log_',
  REFRESH_TOKEN: 'rft_',
} as const;

export const WS_HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds
export const WS_HEARTBEAT_TIMEOUT_MS = 10_000; // 10 seconds
export const WS_MAX_RECONNECT_DELAY_MS = 5 * 60_000; // 5 minutes

export const JWT_EXPIRES_IN = '24h';
export const REFRESH_TOKEN_EXPIRES_IN_DAYS = 30;

export const TUNNEL_LIMITS = {
  free: 3,
  pro: 20,
  enterprise: Infinity,
} as const;

export const RATE_LIMIT = {
  requestsPerWindow: 100,
  windowMs: 60_000, // 1 minute
} as const;

export const REQUEST_BODY_MAX_SIZE = 10 * 1024 * 1024; // 10MB
