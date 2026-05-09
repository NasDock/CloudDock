import { contextBridge, ipcRenderer } from 'electron'

export interface ElectronAPI {
  toggleVPN: () => void
  onVPNStatus: (callback: (status: 'idle' | 'connecting' | 'connected' | 'failed') => void) => () => void
  onVPNStats: (callback: (stats: { bytesIn: number; bytesOut: number }) => void) => () => void
  setAccessToken: (token: string) => void
  clearAccessToken: () => void
  getDeviceId: () => Promise<string>
  getDeviceName: () => Promise<string>
  getDevicePlatform: () => Promise<string>
}

const electronAPI: ElectronAPI = {
  toggleVPN: () => ipcRenderer.send('vpn:toggle'),
  onVPNStatus: (callback) => {
    const handler = (_: any, status: 'idle' | 'connecting' | 'connected' | 'failed') => callback(status)
    ipcRenderer.on('vpn:status', handler)
    return () => ipcRenderer.off('vpn:status', handler)
  },
  onVPNStats: (callback) => {
    const handler = (_: any, stats: { bytesIn: number; bytesOut: number }) => callback(stats)
    ipcRenderer.on('vpn:stats', handler)
    return () => ipcRenderer.off('vpn:stats', handler)
  },
  setAccessToken: (token: string) => ipcRenderer.send('auth:setToken', token),
  clearAccessToken: () => ipcRenderer.send('auth:clearToken'),
  getDeviceId: () => ipcRenderer.invoke('device:getId'),
  getDeviceName: () => ipcRenderer.invoke('device:getName'),
  getDevicePlatform: () => ipcRenderer.invoke('device:getPlatform'),
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
