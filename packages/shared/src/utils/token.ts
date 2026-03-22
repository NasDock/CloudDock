// Token utilities - JWT helpers (signing/verifying done by @fastify/jwt on server side)
// This file provides shared token utility functions

import { nanoid } from 'nanoid';

const TOKEN_BYTE_LENGTH = 32;

/**
 * Generate a cryptographically random token
 * Used for device access tokens and bind tokens
 */
export function generateToken(byteLength: number = TOKEN_BYTE_LENGTH): string {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return nanoid(byteLength);
}
