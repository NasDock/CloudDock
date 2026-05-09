import React, { useEffect, useState } from 'react'
import { AppRouter } from './router'
import { VPNStatusBar } from './components/VPNStatusBar'

const App: React.FC = () => {
  const [vpnStatus, setVpnStatus] = useState<'idle' | 'connecting' | 'connected' | 'failed'>('idle')
  const [vpnStats, setVpnStats] = useState({ bytesIn: 0, bytesOut: 0 })

  useEffect(() => {
    const unsubscribeStatus = window.electronAPI.onVPNStatus((status) => {
      setVpnStatus(status)
    })
    const unsubscribeStats = window.electronAPI.onVPNStats((stats) => {
      setVpnStats(stats)
    })

    // Sync auth token from localStorage to main process on mount and periodically
    const syncToken = () => {
      const token = localStorage.getItem('accessToken')
      if (token) {
        window.electronAPI.setAccessToken(token)
      }
    }
    syncToken()
    const interval = setInterval(syncToken, 5000)

    return () => {
      unsubscribeStatus()
      unsubscribeStats()
      clearInterval(interval)
    }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <VPNStatusBar status={vpnStatus} stats={vpnStats} />
      <div style={{ flex: 1, overflow: 'auto' }}>
        <AppRouter />
      </div>
    </div>
  )
}

export default App
