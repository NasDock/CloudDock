import { execSync } from 'child_process';
import { logger } from './logger.js';

export interface NetworkConfig {
  tunName: string;
  tunAddress: string;
  localSubnet: string;
  enableForwarding: boolean;
}

export function setupLinuxNetworking(config: NetworkConfig): void {
  const { tunName, tunAddress, localSubnet } = config;

  try {
    // Enable IP forwarding
    execSync('sysctl -w net.ipv4.ip_forward=1', { stdio: 'ignore' });

    // Setup NAT for traffic from TUN to local network
    // Using iptables-legacy or iptables depending on system
    const iptables = detectIptables();

    // NAT: packets from tun interface going to localSubnet get masqueraded
    execSync(
      `${iptables} -t nat -A POSTROUTING -o eth0 -s ${tunAddress} -d ${localSubnet} -j MASQUERADE`,
      { stdio: 'ignore' }
    );

    // Allow forwarding from tun to eth0
    execSync(
      `${iptables} -A FORWARD -i ${tunName} -o eth0 -j ACCEPT`,
      { stdio: 'ignore' }
    );

    // Allow forwarding from eth0 to tun (for responses)
    execSync(
      `${iptables} -A FORWARD -i eth0 -o ${tunName} -m state --state RELATED,ESTABLISHED -j ACCEPT`,
      { stdio: 'ignore' }
    );

    logger.info('Linux networking setup complete', { tunName, tunAddress, localSubnet });
  } catch (err: any) {
    logger.warn('Failed to setup Linux networking', { error: err.message });
    // Don't throw - VPN can still work without NAT if routes are configured manually
  }
}

export function teardownLinuxNetworking(config: NetworkConfig): void {
  const { tunName, tunAddress, localSubnet } = config;

  try {
    const iptables = detectIptables();

    execSync(
      `${iptables} -t nat -D POSTROUTING -o eth0 -s ${tunAddress} -d ${localSubnet} -j MASQUERADE 2>/dev/null || true`,
      { stdio: 'ignore' }
    );
    execSync(
      `${iptables} -D FORWARD -i ${tunName} -o eth0 -j ACCEPT 2>/dev/null || true`,
      { stdio: 'ignore' }
    );
    execSync(
      `${iptables} -D FORWARD -i eth0 -o ${tunName} -m state --state RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || true`,
      { stdio: 'ignore' }
    );

    logger.info('Linux networking teardown complete');
  } catch (err: any) {
    logger.warn('Failed to teardown Linux networking', { error: err.message });
  }
}

function detectIptables(): string {
  try {
    execSync('iptables-legacy --version', { stdio: 'ignore' });
    return 'iptables-legacy';
  } catch {
    return 'iptables';
  }
}
