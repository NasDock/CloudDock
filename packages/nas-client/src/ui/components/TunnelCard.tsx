import React from 'react';
import type { TunnelStatus } from '../stores/useStore';

interface TunnelCardProps {
  tunnel: TunnelStatus;
  onSelect?: () => void;
  onToggle?: () => void;
}

export function TunnelCard({ tunnel, onSelect, onToggle }: TunnelCardProps) {
  const statusColors: Record<string, string> = {
    online: '#22c55e',
    offline: '#94a3b8',
    connecting: '#eab308',
    error: '#ef4444',
  };

  const statusLabels: Record<string, string> = {
    online: 'Online',
    offline: 'Offline',
    connecting: 'Connecting...',
    error: 'Error',
  };

  return (
    <div className={`tunnel-card ${tunnel.status}`} onClick={onSelect}>
      <div className="tunnel-card-header">
        <div className="tunnel-info">
          <span
            className="status-dot"
            style={{ backgroundColor: statusColors[tunnel.status] }}
          />
          <h3 className="tunnel-name">{tunnel.name}</h3>
        </div>
        <span className="protocol-badge">{tunnel.protocol.toUpperCase()}</span>
      </div>

      <div className="tunnel-card-body">
        <div className="tunnel-detail">
          <span className="label">Local:</span>
          <span className="value">{tunnel.localAddress}</span>
        </div>
        {tunnel.publicPath && (
          <div className="tunnel-detail">
            <span className="label">Public:</span>
            <span className="value public-path">{tunnel.publicPath}</span>
          </div>
        )}
        <div className="tunnel-detail">
          <span className="label">Status:</span>
          <span
            className="value status-label"
            style={{ color: statusColors[tunnel.status] }}
          >
            {statusLabels[tunnel.status]}
          </span>
        </div>
        {tunnel.error && (
          <div className="tunnel-error">
            {tunnel.error}
          </div>
        )}
      </div>

      <div className="tunnel-card-footer">
        <button
          className={`toggle-btn ${tunnel.status === 'online' ? 'stop' : 'start'}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.();
          }}
        >
          {tunnel.status === 'online' ? 'Stop' : 'Start'}
        </button>
      </div>
    </div>
  );
}
