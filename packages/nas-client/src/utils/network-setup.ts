import { execSync } from 'child_process';
import { logger } from './logger.js';

export interface NetworkConfig {
  tunName: string;
  tunAddress: string;
  localSubnets: string[];
  enableForwarding: boolean;
}

export function setupLinuxNetworking(config: NetworkConfig): void {
  const { tunName, tunAddress, localSubnets } = config;

  try {
    // Enable IP forwarding
    execSync('sysctl -w net.ipv4.ip_forward=1', { stdio: 'ignore' });

    // Setup NAT for traffic from TUN to local network
    // Using iptables-legacy or iptables depending on system
    const iptables = detectIptables();

    for (const subnet of localSubnets) {
      // NAT traffic from TUN to each local subnet (interface-agnostic for NAS/docker compatibility)
      execSync(
        `${iptables} -t nat -A POSTROUTING -s ${tunAddress} -d ${subnet} -j MASQUERADE`,
        { stdio: 'ignore' }
      );

      // Allow forwarding from tun to local subnet
      execSync(
        `${iptables} -A FORWARD -i ${tunName} -d ${subnet} -j ACCEPT`,
        { stdio: 'ignore' }
      );

      // Allow return traffic from local subnet back to tun
      execSync(
        `${iptables} -A FORWARD -o ${tunName} -s ${subnet} -m state --state RELATED,ESTABLISHED -j ACCEPT`,
        { stdio: 'ignore' }
      );
    }

    logger.info('Linux networking setup complete', { tunName, tunAddress, localSubnets });
  } catch (err: any) {
    logger.warn('Failed to setup Linux networking', { error: err.message });
    // Don't throw - VPN can still work without NAT if routes are configured manually
  }
}

export function teardownLinuxNetworking(config: NetworkConfig): void {
  const { tunName, tunAddress, localSubnets } = config;

  try {
    const iptables = detectIptables();

    for (const subnet of localSubnets) {
      execSync(
        `${iptables} -t nat -D POSTROUTING -s ${tunAddress} -d ${subnet} -j MASQUERADE 2>/dev/null || true`,
        { stdio: 'ignore' }
      );
      execSync(
        `${iptables} -D FORWARD -i ${tunName} -d ${subnet} -j ACCEPT 2>/dev/null || true`,
        { stdio: 'ignore' }
      );
      execSync(
        `${iptables} -D FORWARD -o ${tunName} -s ${subnet} -m state --state RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || true`,
        { stdio: 'ignore' }
      );
    }

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
