import React from 'react';
import { useStore } from '../stores/useStore';

export function StatusBar() {
  const { connected, reconnecting, reconnectAttempts, health, lastError, tunnels } = useStore();

  const onlineCount = tunnels.filter((t) => t.status === 'online').length;
  const totalCount = tunnels.length;

  return (
    <div className="status-bar">
      <div className="status-bar-left">
        <span className={`status-indicator ${connected ? 'online' : 'offline'}`}>
          {connected ? '●' : '○'}
        </span>
        <span className="status-text">
          {connected ? 'Connected' : reconnecting ? `Reconnecting (${reconnectAttempts})...` : 'Disconnected'}
        </span>
      </div>

      <div className="status-bar-center">
        <span className="tunnel-count">
          {onlineCount}/{totalCount} Tunnels
        </span>
      </div>

      <div className="status-bar-right">
        {health.latencyMs && (
          <span className="latency">{health.latencyMs}ms</span>
        )}
        {health.healthy !== undefined && (
          <span className={`health-indicator ${health.healthy ? 'healthy' : 'unhealthy'}`}>
            {health.healthy ? '✓' : '✗'}
          </span>
        )}
        {lastError && (
          <span className="error" title={lastError}>⚠</span>
        )}
      </div>
    </div>
  );
}
