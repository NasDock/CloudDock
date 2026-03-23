export interface RuntimeConfig {
  apiUrl?: string;
  wsUrl?: string;
  publicBaseUrl?: string;
}

declare global {
  interface Window {
    __APP_CONFIG__?: RuntimeConfig;
  }
}

export function getRuntimeConfig(): RuntimeConfig {
  if (typeof window === 'undefined') return {};
  return window.__APP_CONFIG__ || {};
}

export function getApiUrl(fallback: string): string {
  const cfg = getRuntimeConfig();
  return cfg.apiUrl || fallback;
}

export function getWsUrl(fallback: string): string {
  const cfg = getRuntimeConfig();
  return cfg.wsUrl || fallback;
}

export function getPublicBaseUrl(fallback: string): string {
  const cfg = getRuntimeConfig();
  return cfg.publicBaseUrl || fallback;
}
