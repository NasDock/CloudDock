import React, { useState } from 'react';
import { useStore, TunnelStatus } from '../stores/useStore';
import { TunnelCard } from '../components/TunnelCard';
import { QRCodeModal } from '../components/QRCodeModal';

export function TunnelConfig() {
  const { tunnels, setTunnels, updateTunnel, serverUrl, deviceToken } = useStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [editingTunnel, setEditingTunnel] = useState<TunnelStatus | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    protocol: 'http' as 'http' | 'tcp',
    localAddress: '',
    localHostname: '',
  });

  const handleAddTunnel = () => {
    if (!formData.name || !formData.localAddress) {
      alert('Please fill in required fields');
      return;
    }

    const newTunnel: TunnelStatus = {
      id: `tunnel_${Date.now()}`,
      name: formData.name,
      protocol: formData.protocol,
      localAddress: formData.localAddress,
      status: 'offline',
    };

    setTunnels([...tunnels, newTunnel]);
    setFormData({ name: '', protocol: 'http', localAddress: '', localHostname: '' });
    setShowAddForm(false);
  };

  const handleToggle = (id: string) => {
    const tunnel = tunnels.find((t) => t.id === id);
    if (!tunnel) return;

    if (tunnel.status === 'online') {
      updateTunnel(id, { status: 'offline' });
    } else {
      updateTunnel(id, { status: 'connecting' });
      setTimeout(() => {
        updateTunnel(id, { status: 'online' });
      }, 1500);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this tunnel?')) {
      setTunnels(tunnels.filter((t) => t.id !== id));
    }
  };

  const generateBindToken = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789';
    const part = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${part()}.${part()}.${part()}`;
  };

  const bindToken = generateBindToken();

  return (
    <div className="page tunnel-config">
      <div className="page-header">
        <h1>Tunnel Configuration</h1>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={() => setShowQR(true)}>
            📱 Show Bind QR
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
            + Add Tunnel
          </button>
        </div>
      </div>

      {tunnels.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔗</div>
          <h2>No Tunnels Configured</h2>
          <p>Add your first tunnel to start exposing local services</p>
          <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
            + Add Your First Tunnel
          </button>
        </div>
      ) : (
        <div className="tunnels-grid">
          {tunnels.map((tunnel) => (
            <TunnelCard
              key={tunnel.id}
              tunnel={tunnel}
              onToggle={() => handleToggle(tunnel.id)}
            />
          ))}
        </div>
      )}

      {/* Add Tunnel Modal */}
      {showAddForm && (
        <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New Tunnel</h3>
              <button className="close-btn" onClick={() => setShowAddForm(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Tunnel Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="My NAS Dashboard"
                />
              </div>
              <div className="form-group">
                <label>Protocol *</label>
                <select
                  value={formData.protocol}
                  onChange={(e) => setFormData({ ...formData, protocol: e.target.value as 'http' | 'tcp' })}
                >
                  <option value="http">HTTP</option>
                  <option value="tcp">TCP</option>
                </select>
              </div>
              <div className="form-group">
                <label>Local Address *</label>
                <input
                  type="text"
                  value={formData.localAddress}
                  onChange={(e) => setFormData({ ...formData, localAddress: e.target.value })}
                  placeholder="192.168.1.100:5000"
                />
                <small>Format: host:port</small>
              </div>
              <div className="form-group">
                <label>Local Hostname (HTTP only)</label>
                <input
                  type="text"
                  value={formData.localHostname}
                  onChange={(e) => setFormData({ ...formData, localHostname: e.target.value })}
                  placeholder="nas.example.com"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddForm(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleAddTunnel}>
                Add Tunnel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      <QRCodeModal
        isOpen={showQR}
        onClose={() => setShowQR(false)}
        value={`${serverUrl}|${bindToken}`}
        title="Scan to Bind Device"
      />
    </div>
  );
}
