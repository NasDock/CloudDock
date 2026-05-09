import React from 'react'

interface VPNStatusBarProps {
  status: 'idle' | 'connecting' | 'connected' | 'failed'
  stats: { bytesIn: number; bytesOut: number }
}

export const VPNStatusBar: React.FC<VPNStatusBarProps> = ({ status, stats }) => {
  const handleToggle = () => {
    window.electronAPI.toggleVPN()
  }

  const statusLabel = {
    idle: '未连接',
    connecting: '连接中...',
    connected: '已连接',
    failed: '连接失败',
  }[status]

  const statusColor = {
    idle: '#9CA3AF',
    connecting: '#F59E0B',
    connected: '#10B981',
    failed: '#EF4444',
  }[status]

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        backgroundColor: '#1F2937',
        color: '#FFFFFF',
        fontSize: 13,
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: statusColor,
          }}
        />
        <span>异地组网: {statusLabel}</span>
        {status === 'connected' && (
          <span style={{ color: '#9CA3AF', marginLeft: 8 }}>
            入: {(stats.bytesIn / 1024).toFixed(1)} KB / 出: {(stats.bytesOut / 1024).toFixed(1)} KB
          </span>
        )}
      </div>
      <button
        onClick={handleToggle}
        disabled={status === 'connecting'}
        style={{
          padding: '4px 12px',
          fontSize: 12,
          cursor: status === 'connecting' ? 'not-allowed' : 'pointer',
          backgroundColor: status === 'connected' ? '#EF4444' : '#10B981',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: 4,
        }}
      >
        {status === 'connected' ? '断开' : '连接'}
      </button>
    </div>
  )
}
