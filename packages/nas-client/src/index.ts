#!/usr/bin/env node

import type { ClientStatus } from './client.js';
import { NASClient } from './client.js';
import { startLocalApi } from './local-api.js';
import { loadConfig } from './utils/config-store.js';

// ANSI colors
const colors = {
  reset: '\x1b[0m', bright: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', cyan: '\x1b[36m', white: '\x1b[37m'
};

function c(color: keyof typeof colors, text: string): string {
  return `${colors[color]}${text}${colors.reset}`;
}

class CLI {
  private client: NASClient | null = null;
  private pairingCode: string | null = null;

  async start(): Promise<void> {
    const args = process.argv.slice(2);
    const command = args[0] || 'start';

    switch (command) {
      case 'start':
        await this.startClient();
        break;
      case 'status':
        await this.showStatus();
        break;
      case 'help':
        this.showHelp();
        break;
      default:
        console.error(c('red', `Unknown command: ${command}`));
        this.showHelp();
    }
  }

  async startClient(): Promise<void> {
    const config = loadConfig();

    console.log(c('cyan', '╔══════════════════════════════════════╗'));
    console.log(c('cyan', '║       NAS Client - CloudDock         ║'));
    console.log(c('cyan', '╚══════════════════════════════════════╝'));
    console.log();

    this.client = new NASClient();
    startLocalApi(this.client);

    this.client.on('status_change', (status: ClientStatus) => {
      this.renderStatusBar(status);
    });

    this.client.on('tunnel_update', (tunnel: any) => {
      console.log(c('yellow', `[Tunnel] ${tunnel.name} status: ${tunnel.status}`));
    });

    // Handle pairing code display
    this.client.on('pairing_code', (code: string) => {
      this.pairingCode = code;
      console.log();
      console.log(c('bright', '╔══════════════════════════════════════════════════════╗'));
      console.log(c('bright', '║              PAIRING REQUIRED                          ║'));
      console.log(c('bright', '╚══════════════════════════════════════════════════════╝'));
      console.log();
      console.log(`  ${c('yellow', '⚠ This client is not paired with any account.')}`);
      console.log();
      console.log(`  ${c('white', 'Your pairing code:')} ${c('bright', c('green', code))}`);
      console.log();
      console.log(`  ${c('dim', 'Open the web UI → Clients page → Enter this code')}`);
      console.log();
    });

    // Handle pairing approved
    this.client.on('pairing_approved', ({ clientKey }: { clientKey: string }) => {
      console.log();
      console.log(c('green', `  ✓ Paired successfully!`));
      console.log(c('green', `  ✓ Client key saved.`));
      console.log();
    });

    this.client.on('tunnels_sync', (tunnels: any[]) => {
      console.log(c('green', `  ✓ Received ${tunnels.length} tunnel(s)`));
    });

    try {
      console.log(c('blue', 'Connecting...'));
      await this.client.connect();

      console.log(c('green', '✓ Connected!'));
      console.log();
      console.log(c('white', 'Press Ctrl+C to stop'));
      console.log();

      await this.renderDashboard();
    } catch (err: any) {
      if (this.pairingCode) {
        // Still show dashboard with pairing code
        console.log(c('red', `Connection error: ${err.message}`));
        console.log();
        console.log(c('yellow', 'Waiting for pairing...'));
        console.log(`  ${c('dim', 'Use the code above to pair in web UI')}`);
        console.log();
        await this.renderDashboard();
      } else {
        console.error(c('red', `Failed to connect: ${err.message}`));
        await this.renderDashboard();
      }
    }

    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  private renderStatusBar(status: ClientStatus): void {
    const color = status.connected ? 'green' : 'red';
    const text = status.connected ? 'CONNECTED' : 'DISCONNECTED';
    const reconn = status.reconnecting ? ` (reconnect #${status.reconnectAttempts})` : '';
    process.stdout.write(`\r${c(color, `[${text}]`)}${reconn} `);
  }

  private async renderDashboard(): Promise<void> {
    if (!this.client) return;

    const tunnels = this.client.tunnelManager.getAllTunnels();
    const health = await this.client.healthCheck.check().catch(() => ({ healthy: false }));
    const status = this.client.getStatus();

    console.clear();
    console.log(c('cyan', '╔════════════════════════════════════════════════════════╗'));
    console.log(c('cyan', '║              NAS Client Dashboard                        ║'));
    console.log(c('cyan', '╚════════════════════════════════════════════════════════╝'));
    console.log();

    const connStatus = status.connected ? c('green', '● Online') : c('red', '○ Offline');
    console.log(`  ${c('white', 'Connection:')} ${connStatus}`);

    if (this.pairingCode) {
      console.log();
      console.log(`  ${c('yellow', '⚠ Not paired - waiting for approval')}`);
      console.log(`  ${c('white', 'Pairing code:')} ${c('bright', c('green', this.pairingCode))}`);
    }

    if (status.latencyMs) {
      console.log(`  ${c('white', 'Latency:')} ${status.latencyMs}ms`);
    }

    if (health.healthy !== undefined) {
      const h = health.healthy ? c('green', '● Healthy') : c('red', '● Unhealthy');
      console.log(`  ${c('white', 'Health:')} ${h}`);
    }

    console.log();
    console.log(`  ${c('white', 'Tunnels:')} ${tunnels.length}`);
    console.log();

    for (const tunnel of tunnels) {
      const sc = tunnel.status === 'online' ? 'green' : tunnel.status === 'error' ? 'red' : 'yellow';
      const icon = tunnel.status === 'online' ? '●' : tunnel.status === 'error' ? '✗' : '○';
      console.log(`    ${c(sc, icon)} ${c('white', tunnel.name)}`);
      console.log(`       ${c('dim', `${tunnel.protocol} -> ${tunnel.localAddress}`)}`);
      if (tunnel.publicPath) console.log(`       ${c('cyan', tunnel.publicPath)}`);
      console.log();
    }
  }

  private async showStatus(): Promise<void> {
    const config = loadConfig();
    console.log(c('cyan', 'NAS Client Status'));
    console.log('─'.repeat(50));
    console.log(`  Server: ${config.serverUrl}`);
    console.log(`  Client Key: ${config.clientKey ? c('green', '✓ configured') : c('yellow', '✗ not set')}`);
    console.log(`  Device Name: ${config.deviceName}`);
    console.log(`  Tunnels: ${config.tunnels.length}`);
    console.log();
  }

  private showHelp(): void {
    console.log(c('cyan', 'NAS Client'));
    console.log('─'.repeat(50));
    console.log(`  ${c('green', 'nas-client start')}    Start client (auto-pair if needed)`);
    console.log(`  ${c('green', 'nas-client status')}   Show status`);
    console.log(`  ${c('green', 'nas-client help')}    Show this help`);
    console.log();
  }

  private shutdown(): void {
    console.log(c('yellow', '\nShutting down...'));
    this.client?.disconnect();
    process.exit(0);
  }
}

const cli = new CLI();
cli.start().catch((err) => {
  console.error(c('red', 'Fatal:'), err);
  process.exit(1);
});
