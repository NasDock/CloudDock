import React, { useEffect } from 'react';
import { useStore } from './stores/useStore';
import { StatusBar } from './components/StatusBar';
import { Dashboard } from './pages/Dashboard';
import { TunnelConfig } from './pages/TunnelConfig';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';

export function App() {
  const {
    currentPage,
    setCurrentPage,
    deviceToken,
    isConfiguring,
    setConfiguring,
    connected,
    setConnected
  } = useStore();

  useEffect(() => {
    // Check if we have a device token
    if (!deviceToken) {
      setConfiguring(true);
    }
  }, [deviceToken, setConfiguring]);

  // If no token or in configuration mode, show login
  if (!deviceToken || isConfiguring) {
    return <Login />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'tunnels':
        return <TunnelConfig />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-logo">
          <span className="logo-icon">🌐</span>
          <span className="logo-text">NAS Tunnel</span>
        </div>
        <StatusBar />
      </header>

      <nav className="app-nav">
        <button
          className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`}
          onClick={() => setCurrentPage('dashboard')}
        >
          📊 Dashboard
        </button>
        <button
          className={`nav-item ${currentPage === 'tunnels' ? 'active' : ''}`}
          onClick={() => setCurrentPage('tunnels')}
        >
          🔗 Tunnels
        </button>
        <button
          className={`nav-item ${currentPage === 'settings' ? 'active' : ''}`}
          onClick={() => setCurrentPage('settings')}
        >
          ⚙️ Settings
        </button>
      </nav>

      <main className="app-main">
        {renderPage()}
      </main>

      <footer className="app-footer">
        <p>NAS Tunnel Client v1.0.0</p>
      </footer>
    </div>
  );
}
