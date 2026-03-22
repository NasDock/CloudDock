import React from 'react';
import { useStore } from '../stores/useStore';
import { TunnelCard } from '../components/TunnelCard';

export function Dashboard() {
  const { connected, health, tunnels, setCurrentPage, updateTunnel } = useStore();

  const onlineTunnels = tunnels.filter((t) => t.status === 'online').length;
  const totalTunnels = tunnels.length;

  const handleToggleTunnel = (id: string) => {
    const tunnel = tunnels.find((t) => t.id === id);
    if (!tunnel) return;

    if (tunnel.status === 'online') {
      // Stop tunnel
      updateTunnel(id, { status: 'offline' });
    } else {
      // Start tunnel
      updateTunnel(id, { status: 'connecting' });
      // Simulate connection after delay
      setTimeout(() => {
        updateTunnel(id, { status: 'online' });
      }, 1000);
    }
  };

  return (
    <div className="page dashboard">
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">🌐</div>
          <div className="stat-content">
            <div className="stat-value">{connected ? 'Online' : 'Offline'}</div>
            <div className="stat-label">Connection</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🔗</div>
          <div className="stat-content">
            <div className="stat-value">{onlineTunnels}/{totalTunnels}</div>
            <div className="stat-label">Active Tunnels</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-value">{health.latencyMs ?? '--'}ms</div>
            <div className="stat-label">Latency</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">❤️</div>
          <div className="stat-content">
            <div className="stat-value">{health.healthy ? 'Good' : 'Poor'}</div>
            <div className="stat-label">Health</div>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <h2>Quick Actions</h2>
        </div>
        <div className="actions-grid">
          <button
            className="action-btn"
            onClick={() => setCurrentPage('tunnels')}
          >
            <span className="action-icon">🔧</span>
            <span className="action-label">Manage Tunnels</span>
          </button>
          <button
            className="action-btn"
            onClick={() => setCurrentPage('settings')}
          >
            <span className="action-icon">⚙️</span>
            <span className="action-label">Settings</span>
          </button>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <h2>Recent Activity</h2>
        </div>
        <div className="activity-list">
          <div className="activity-item">
            <span className="activity-icon">🔌</span>
            <span className="activity-text">System ready</span>
            <span className="activity-time">Just now</span>
          </div>
          {tunnels.map((tunnel) => (
            <div key={tunnel.id} className="activity-item">
              <span className="activity-icon">
                {tunnel.status === 'online' ? '✅' : '⚪'}
              </span>
              <span className="activity-text">
                Tunnel "{tunnel.name}" is {tunnel.status}
              </span>
              <span className="activity-time">
                {tunnel.status === 'online' ? 'Active' : 'Inactive'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
