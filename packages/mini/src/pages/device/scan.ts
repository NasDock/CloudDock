import { deviceApi } from '../../api/device';
import { authStore } from '../../stores/auth';

interface ScanPageData {
  hasCameraPermission: boolean;
  permissionLoading: boolean;
  scanned: boolean;
  binding: boolean;
  error: string;
  toastVisible: boolean;
  toastText: string;
  // QRScanScreen state
  mode: 'permission' | 'scan' | 'result' | 'binding' | 'success' | 'error';
  scanResult: string;
  deviceInfo: {
    name: string;
    id: string;
  } | null;
  signalStatus: 'idle' | 'connecting' | 'connected' | 'failed';
  sessionId: string;
}

Page({
  data: {
    hasCameraPermission: false,
    permissionLoading: false,
    scanned: false,
    binding: false,
    error: '',
    toastVisible: false,
    toastText: '',
    // QRScanScreen
    mode: 'permission' as ScanPageData['mode'],
    scanResult: '',
    deviceInfo: null,
    signalStatus: 'idle' as ScanPageData['signalStatus'],
    sessionId: '',
  } as ScanPageData,

  onLoad() {
    this.checkPermission();
  },

  onShow() {
    // Reset state when returning to this page
    if (this.data.mode === 'result' || this.data.mode === 'error') {
      this.setData({ mode: 'scan' });
    }
  },

  onUnload() {
    // Cleanup
  },

  checkPermission() {
    this.setData({ permissionLoading: true });
    wx.getSetting({
      success: (res) => {
        const hasCamera = !!res.authSetting['scope.camera'];
        this.setData({
          hasCameraPermission: hasCamera,
          permissionLoading: false,
          mode: hasCamera ? 'scan' : 'permission',
        });
      },
      fail: () => {
        this.setData({
          hasCameraPermission: false,
          permissionLoading: false,
          mode: 'permission',
        });
      },
    });
  },

  requestPermission() {
    wx.openSetting({
      success: (res) => {
        const hasCamera = !!res.authSetting['scope.camera'];
        this.setData({
          hasCameraPermission: hasCamera,
          mode: hasCamera ? 'scan' : 'permission',
        });
      },
    });
  },

  /**
   * Trigger QR code scan via wx.scanCode.
   * Called by the "Scan QR Code" button on the scan screen.
   */
  handleStartScan() {
    if (this.data.binding) return;
    wx.scanCode({
      onlyFromCamera: true,
      scanType: ['qrCode'],
      success: (res) => {
        const result = res.result?.trim() || '';
        if (!result) {
          this.showToast('未识别到二维码内容');
          return;
        }
        this.processQRContent(result);
      },
      fail: (err) => {
        const errMsg = err?.errMsg || '';
        if (errMsg.includes('cancel')) {
          // User cancelled, do nothing
          return;
        }
        console.warn('[scan] wx.scanCode failed', err);
        this.showToast('扫描失败，请重试');
      },
    });
  },

  /**
   * Also handle camera component scan event (legacy support).
   */
  onScanSuccess(e: any) {
    const result = e.detail?.result?.trim();
    if (result) {
      this.processQRContent(result);
    }
  },

  /**
   * Process QR code content — determine if it's a bind token or signaling code.
   */
  processQRContent(content: string) {
    console.info('[scan] QR content:', content);

    // Detect content type
    if (content.includes('clouddock://bind/')) {
      // Bind token format: clouddock://bind/{token}
      const token = content.replace('clouddock://bind/', '');
      this.setData({ scanned: true });
      this.handleBind(token);
    } else if (content.includes('clouddock://signal/')) {
      // Signaling code format: clouddock://signal/{deviceId}
      const deviceId = content.replace('clouddock://signal/', '');
      this.setData({ scanned: true, mode: 'result' });
      this.initiateSignaling(deviceId);
    } else if (content.includes('.') && content.length < 512) {
      // Likely a bind token (base64-like with dots)
      this.setData({ scanned: true });
      this.handleBind(content);
    } else {
      this.showToast('无效的二维码格式');
      this.setData({ scanned: false, mode: 'scan' });
    }
  },

  /**
   * Bind device via token.
   */
  async handleBind(bindToken: string) {
    if (this.data.binding) return;
    this.setData({ binding: true, mode: 'binding', error: '' });

    try {
      const device = await deviceApi.bind({
        bindToken,
        deviceName: `Mini ${Date.now()}`,
      });

      this.setData({
        deviceInfo: { name: device.name, id: bindToken.slice(0, 8) },
        mode: 'success',
        binding: false,
      });

      setTimeout(() => {
        if (this.data.mode === 'success') {
          wx.navigateBack();
        }
      }, 2000);
    } catch (err: any) {
      const msg = err?.message || '绑定失败';
      this.showToast(msg);
      this.setData({ mode: 'error', binding: false, scanned: false, error: msg });
    }
  },

  /**
   * Initiate WebRTC signaling with scanned device.
   */
  async initiateSignaling(deviceId: string) {
    const token = wx.getStorageSync('accessToken');
    if (!token) {
      this.showToast('请先登录');
      return;
    }

    this.setData({
      sessionId: deviceId,
      signalStatus: 'connecting',
      mode: 'result',
    });

    try {
      const { startWebRTC } = require('../../../src/webrtc');

      const serverUrl = getApp<IAppOption>().globalData.apiBaseUrl.replace(/^http/, 'wss');

      const manager = startWebRTC({
        serverUrl,
        deviceId,
        token,
        role: 'caller',
        onReady: () => {
          console.info('[scan] WebRTC signaling ready');
          this.setData({ signalStatus: 'connected' });
          wx.showModal({
            title: '连接成功',
            content: '与设备的 P2P 信令通道已建立',
            showCancel: false,
          });
        },
        onClose: () => {
          console.info('[scan] WebRTC signaling closed');
          this.setData({ signalStatus: 'idle' });
        },
        onError: (err) => {
          console.warn('[scan] WebRTC signaling error', err);
          this.setData({ signalStatus: 'failed' });
          this.showToast(err);
        },
        onOffer: (sdp) => {
          console.info('[scan] offer generated', sdp?.slice(0, 40));
        },
        onAnswer: (sdp) => {
          console.info('[scan] answer received', sdp?.slice(0, 40));
        },
      });

      // Store manager reference on page
      (this as any)._webrtcManager = manager;
    } catch (err: any) {
      console.error('[scan] signaling init failed', err);
      this.setData({ signalStatus: 'failed' });
      this.showToast('信令连接失败');
    }
  },

  /**
   * End signaling session.
   */
  handleEndSignaling() {
    const manager = (this as any)._webrtcManager;
    if (manager) {
      manager.close();
      (this as any)._webrtcManager = null;
    }
    this.setData({ signalStatus: 'idle', mode: 'scan', scanned: false });
  },

  /**
   * Retry signaling connection.
   */
  handleRetrySignaling() {
    const { sessionId } = this.data;
    if (sessionId) {
      this.setData({ mode: 'result' });
      this.initiateSignaling(sessionId);
    }
  },

  handleRescan() {
    this.setData({
      scanned: false,
      mode: this.data.hasCameraPermission ? 'scan' : 'permission',
      error: '',
      scanResult: '',
      deviceInfo: null,
      signalStatus: 'idle',
      sessionId: '',
    });
  },

  showToast(text: string) {
    this.setData({ toastText: text, toastVisible: true });
    setTimeout(() => this.setData({ toastVisible: false }), 2500);
  },
});
