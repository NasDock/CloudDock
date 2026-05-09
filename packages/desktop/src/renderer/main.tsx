import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// Sync desktop device identity into localStorage so the web UI registers
// this Electron instance as a proper Desktop request-device instead of generic Web.
(async () => {
  const [deviceId, deviceName, devicePlatform] = await Promise.all([
    window.electronAPI.getDeviceId(),
    window.electronAPI.getDeviceName(),
    window.electronAPI.getDevicePlatform(),
  ])
  localStorage.setItem('requestDeviceId', deviceId)
  localStorage.setItem('requestDeviceName', deviceName)
  localStorage.setItem('requestDevicePlatform', devicePlatform)

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
})()
