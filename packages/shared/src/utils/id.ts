import { customAlphabet } from 'nanoid';
import { ID_PREFIXES } from '../constants/index.js';

// Alphabet without ambiguous characters (0, O, I, l)
const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const nanoid = customAlphabet(alphabet, 12);
const nanoid16 = customAlphabet(alphabet, 16);

export function generateUserId(): string {
  return `${ID_PREFIXES.USER}${nanoid()}`;
}

export function generateDeviceId(): string {
  return `${ID_PREFIXES.DEVICE}${nanoid()}`;
}

export function generateTunnelId(): string {
  return `${ID_PREFIXES.TUNNEL}${nanoid()}`;
}

export function generateSessionId(): string {
  return `${ID_PREFIXES.SESSION}${nanoid()}`;
}

export function generateLogId(): string {
  return `${ID_PREFIXES.LOG}${nanoid()}`;
}

export function generateRefreshTokenId(): string {
  return `${ID_PREFIXES.REFRESH_TOKEN}${nanoid16()}`;
}

export function generateAccessToken(): string {
  return nanoid(32);
}

export function generateBindToken(): string {
  // QR code readable format: XXXX.YYYY.ZZZZ
  return `${nanoid(4).toUpperCase()}.${nanoid(4).toUpperCase()}.${nanoid(4).toUpperCase()}`;
}

export function isValidIdPrefix(id: string): boolean {
  return Object.values(ID_PREFIXES).some((prefix) => id.startsWith(prefix));
}
