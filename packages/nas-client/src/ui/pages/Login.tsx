import React, { useState } from 'react';
import { useStore } from '../stores/useStore';

export function Login() {
  const { setDeviceToken, setConfiguring } = useStore();
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token.trim()) {
      setError('Please enter a device token');
      return;
    }

    setLoading(true);
    setError('');

    // Simulate validation
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (token.length < 10) {
      setError('Invalid token format');
      setLoading(false);
      return;
    }

    setDeviceToken(token);
    setConfiguring(false);
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>NAS Client</h1>
          <p>Enter your device token to continue</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Device Token</label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Enter your device token"
              autoFocus
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Validating...' : 'Connect'}
          </button>
        </form>

        <div className="login-footer">
          <p>
            Don't have a token?{' '}
            <a href="#" onClick={(e) => { e.preventDefault(); alert('Please register your device on the web console'); }}>
              Register device
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
