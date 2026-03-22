import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { logger } from './logger.js';

export interface NASConfig {
  serverUrl: string;
  clientKey: string;
  deviceName: string;
  tunnels: TunnelConfig[];
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  reconnectInterval: number; // ms
  maxReconnectDelay: number; // ms
  heartbeatInterval: number; // ms
}

export interface TunnelConfig {
  tunnelId?: string;
  name: string;
  protocol: 'http' | 'tcp' | 'udp';
  localAddress: string;
  localHostname?: string;
}

const DEFAULT_CONFIG: NASConfig = {
  serverUrl: process.env.NAS_SERVER_WS_URL || 'ws://localhost:3300/ws/device',
  clientKey: '',
  deviceName: 'My NAS',
  tunnels: [],
  logLevel: 'info',
  reconnectInterval: 1000,
  maxReconnectDelay: 5 * 60 * 1000, // 5 minutes
  heartbeatInterval: 30000 // 30 seconds
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = join(__dirname, '../../.config');
const CONFIG_FILE = join(CONFIG_DIR, 'config.yaml');

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): NASConfig {
  ensureConfigDir();

  if (!existsSync(CONFIG_FILE)) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const raw = readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = yaml.load(raw) as Partial<NASConfig>;
    // Backward compat: if deviceToken exists in config, migrate it to clientKey
    const config = { ...DEFAULT_CONFIG, ...parsed };
    if (!config.clientKey && (parsed as any).deviceToken) {
      config.clientKey = (parsed as any).deviceToken;
    }
    return config;
  } catch (error) {
    logger.warn('Failed to load config, using defaults', { error });
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: NASConfig): void {
  ensureConfigDir();

  try {
    const raw = yaml.dump(config, { indent: 2, lineWidth: 120 });
    writeFileSync(CONFIG_FILE, raw, 'utf-8');
    logger.info('Config saved', { path: CONFIG_FILE });
  } catch (error) {
    logger.error('Failed to save config', { error });
    throw error;
  }
}

export function updateConfig(updates: Partial<NASConfig>): NASConfig {
  const config = loadConfig();
  const newConfig = { ...config, ...updates };
  saveConfig(newConfig);
  return newConfig;
}
