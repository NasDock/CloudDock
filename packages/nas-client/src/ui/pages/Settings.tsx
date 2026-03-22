import React, { useState, useEffect } from 'react';
import { useStore } from '../stores/useStore';

export function Settings() {
  const {
    serverUrl,
    deviceToken,
    deviceName,
    setServerUrl,
    setDeviceToken,
    setDeviceName,
    connected
  } = useStore();

  const [localServerUrl, setLocalServerUrl] = useState(serverUrl);
  const [localDeviceToken, setLocalDeviceToken] = useState(deviceToken);
  const [localDeviceName, setLocalDeviceName] = useState(deviceName);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLocalServerUrl(serverUrl);
    setLocalDeviceToken(deviceToken);
    setLocalDeviceName(deviceName);
  }, [serverUrl, deviceToken, deviceName]);

  const handleSave = () => {
    setServerUrl(localServerUrl);
    setDeviceToken(localDeviceToken);
    setDeviceName(localDeviceName);

    // In production, this would persist to config file
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setLocalServerUrl(serverUrl);
    setLocalDeviceToken(deviceToken);
    setLocalDeviceName(deviceName);
  };

  return (
    <div className="page settings">
      <div className="page-header">
        <h1>Settings</h1>
      </div>

      <div className="settings-sections">
        <div className="settings-section">
          <h2>Connection Settings</h2>
          <p className="section-description">
            Configure how this NAS client connects to the tunnel server
          </p>

          <div className="form-group">
            <label>Server URL</label>
            <input
              type="url"
              value={localServerUrl}
              onChange={(e) => setLocalServerUrl(e.target.value)}
              placeholder="wss://tunnel.example.com/ws/device"
              disabled={connected}
            />
            <small>The WebSocket server endpoint</small>
          </div>

          <div className="form-group">
            <label>Device Token</label>
            <input
              type="password"
              value={localDeviceToken}
              onChange={(e) => setLocalDeviceToken(e.target.value)}
              placeholder="Enter your device token"
              disabled={connected}
            />
            <small>Authentication token for this device</small>
          </div>
        </div>

        <div className="settings-section">
          <h2>Device Settings</h2>
          <p className="section-description">
            Configure the device name and preferences
          </p>

          <div className="form-group">
            <label>Device Name</label>
            <input
              type="text"
              value={localDeviceName}
              onChange={(e) => setLocalDeviceName(e.target.value)}
              placeholder="My NAS"
            />
            <small>Display name for this device</small>
          </div>
        </div>

        <div className="settings-section">
          <h2>Advanced</h2>

          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Reconnect Interval</span>
              <span className="setting-value">1000ms</span>
            </div>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Max Reconnect Delay</span>
              <span className="setting-value">5 minutes</span>
            </div>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Heartbeat Interval</span>
              <span className="setting-value">30 seconds</span>
            </div>
          </div>
        </div>

        <div className="settings-actions">
          <button className="btn btn-secondary" onClick={handleReset}>
            Reset
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            {saved ? '✓ Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
