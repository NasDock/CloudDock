import crypto from 'crypto';

export interface TurnServerConfig {
  urls: string | string[];
  username: string;
  credential: string;
}

/**
 * Generate temporary TURN credentials using the TURN REST API (RFC 8489).
 *
 * This mechanism allows the server to generate short-lived credentials
 * without sharing the long-term secret with clients.
 *
 * How it works:
 * 1. Server and coturn share a static secret (configured via --static-auth-secret)
 * 2. Server generates: username = "timestamp:random" (timestamp = expiry unixtime)
 * 3. Server generates: credential = base64(hmac-sha1(secret, username))
 * 4. Client uses these temporary credentials to authenticate with coturn
 * 5. coturn verifies the HMAC using the same shared secret
 *
 * @param turnUrls - TURN server URLs (e.g., ["turn:host:3478"])
 * @param sharedSecret - The shared secret configured in coturn
 * @param ttl - Credential lifetime in seconds (default: 86400 = 24 hours)
 * @returns TurnServerConfig array with temporary credentials
 */
export function generateTurnCredentials(
  turnUrls: string | string[],
  sharedSecret: string,
  ttl: number = 86400
): TurnServerConfig {
  // Expiry timestamp
  const timestamp = Math.floor(Date.now() / 1000) + ttl;

  // Username format: "timestamp:random"
  const randomPart = crypto.randomBytes(8).toString('hex');
  const username = `${timestamp}:${randomPart}`;

  // Credential = base64(HMAC-SHA1(sharedSecret, username))
  const hmac = crypto.createHmac('sha1', sharedSecret);
  hmac.update(username);
  const credential = hmac.digest('base64');

  return {
    urls: turnUrls,
    username,
    credential,
  };
}

/**
 * Build TURN server configs from environment variables.
 *
 * Expected env vars:
 * - CLOUD_DOCK_TURN_URLS: JSON array of TURN URLs, e.g. '["turn:host:3478","turns:host:5349"]'
 * - CLOUD_DOCK_TURN_SECRET: Shared secret with coturn (keep this secret!)
 *
 * If TURN is not configured, returns empty array.
 */
export function buildTurnServersFromEnv(): TurnServerConfig[] {
  const turnUrlsEnv = process.env.CLOUD_DOCK_TURN_URLS;
  const turnSecret = process.env.CLOUD_DOCK_TURN_SECRET;

  if (!turnUrlsEnv || !turnSecret) {
    return [];
  }

  try {
    const urls = JSON.parse(turnUrlsEnv) as string[];
    if (!Array.isArray(urls) || urls.length === 0) {
      return [];
    }

    const config = generateTurnCredentials(urls, turnSecret);
    return [config];
  } catch (err: any) {
    console.error('[turn] Failed to build TURN servers from env:', err.message);
    return [];
  }
}
