/**
 * SignalPage — P2P WebRTC 信令交换页面
 *
 * 用于建立和管理与 NAS 设备的 P2P 信令通道。
 * 支持两种模式：
 *  1. 发起模式 (role=caller)：扫描设备二维码，发起信令交换
 *  2. 接收模式 (role=callee)：作为被叫方，响应远程请求
 *
 * 信令流程 (参考 packages/mobile/src/webrtc/webrtc-manager.ts):
 *  1. 连接信令服务器 (WebSocket)
 *  2. Caller: 创建 offer SDP → 发送 offer → 等待 answer
 *  3. Callee: 接收 offer → 创建 answer → 发送 answer
 *  4. 交换 ICE candidates 直到连接建立
 */

import { startWebRTC, stopWebRTC, WebRTCManager } from '../../webrtc';
import { authStore } from '../../stores/auth';

type SignalMode = 'idle' | 'connecting' | 'waiting_answer' | 'connected' | 'failed' | 'closed';

interface SignalPageData {
  // Session params
  deviceId: string;
  role: 'caller' | 'callee';
  // UI state
  mode: SignalMode;
  error: string;
  offerSdp: string;
  answerSdp: string;
  iceCandidates: string[];
  toastVisible: boolean;
  toastText: string;
  // Manual SDP exchange
  localSdpInput: string;
  remoteSdpInput: string;
  showManualExchange: boolean;
}

Page({
  data: {
    deviceId: '',
    role: 'caller' as 'caller' | 'callee',
    mode: 'idle' as SignalMode,
    error: '',
    offerSdp: '',
    answerSdp: '',
    iceCandidates: [] as string[],
    toastVisible: false,
    toastText: '',
    localSdpInput: '',
    remoteSdpInput: '',
    showManualExchange: false,
  } as SignalPageData,

  private manager: WebRTCManager | null = null;

  onLoad(query: Record<string, string>) {
    // Accept deviceId and role from query params
    const deviceId = query.deviceId || '';
    const role = (query.role as 'caller' | 'callee') || 'caller';
    this.setData({ deviceId, role });

    if (deviceId) {
      // Auto-start if deviceId provided
      wx.nextTick(() => this.startSignaling());
    }
  },

  onUnload() {
    this.cleanup();
  },

  /**
   * Start the signaling process.
   */
  startSignaling() {
    const { deviceId, role } = this.data;
    const token = wx.getStorageSync('accessToken');

    if (!token) {
      this.showToast('请先登录');
      return;
    }
    if (!deviceId) {
      this.showToast('缺少设备 ID');
      return;
    }

    this.cleanup();

    const app = getApp<IAppOption>();
    const serverUrl = app.globalData.apiBaseUrl.replace(/^http/, 'wss');

    this.setData({ mode: 'connecting', error: '' });

    this.manager = startWebRTC({
      serverUrl,
      deviceId,
      token,
      role,
      onReady: () => {
        this.setData({ mode: 'connected' });
        console.info('[signal-page] session ready');
      },
      onClose: () => {
        this.setData({ mode: 'closed' });
        console.info('[signal-page] session closed');
      },
      onError: (err) => {
        this.setData({ mode: 'failed', error: err });
        this.showToast(err);
      },
      onOffer: (sdp) => {
        this.setData({ offerSdp: sdp, mode: 'waiting_answer' });
        console.info('[signal-page] offer generated, waiting for answer');
      },
      onAnswer: (sdp) => {
        this.setData({ answerSdp: sdp });
        console.info('[signal-page] answer received');
      },
      onIceCandidate: (candidate) => {
        const str = JSON.stringify(candidate);
        this.setData((prev: SignalPageData) => ({
          iceCandidates: [...prev.iceCandidates, str],
        }));
        console.info('[signal-page] ICE candidate received');
      },
    });

    console.info('[signal-page] started', { deviceId, role });
  },

  /**
   * Stop signaling session.
   */
  stopSignaling() {
    this.cleanup();
    this.setData({ mode: 'idle', error: '' });
  },

  /**
   * Manually paste and submit an offer SDP (caller side).
   */
  handleSubmitOffer() {
    const sdp = this.data.localSdpInput.trim();
    if (!sdp) {
      this.showToast('请输入 Offer SDP');
      return;
    }
    this.manager?.sendSignal('offer', { sdp });
    this.setData({ offerSdp: sdp, mode: 'waiting_answer' });
    this.showToast('Offer 已发送，等待 Answer...');
  },

  /**
   * Manually paste and submit an answer SDP (callee side).
   */
  handleSubmitAnswer() {
    const sdp = this.data.remoteSdpInput.trim();
    if (!sdp) {
      this.showToast('请输入 Answer SDP');
      return;
    }
    this.manager?.setRemoteAnswer(sdp);
    this.setData({ answerSdp: sdp });
    this.showToast('Answer 已设置');
  },

  /**
   * Manually submit remote offer SDP (callee receives offer from peer).
   */
  handleRemoteOffer() {
    const sdp = this.data.remoteSdpInput.trim();
    if (!sdp) {
      this.showToast('请输入远程 Offer SDP');
      return;
    }
    this.manager?.setRemoteOffer(sdp);
    this.setData({ offerSdp: sdp, mode: 'waiting_answer' });
    this.showToast('Offer 已收到，请生成 Answer');
  },

  /**
   * Generate answer (callee side) after receiving offer.
   */
  handleGenerateAnswer() {
    if (this.data.role !== 'callee') {
      this.showToast('只有被叫方可以生成 Answer');
      return;
    }
    // In a full WebRTC flow this would call pc.createAnswer().
    // Here we signal the UI to manually handle SDP exchange.
    this.setData({ mode: 'waiting_answer' });
    this.showToast('Answer 生成中（请通过信令服务器交换）');
  },

  /**
   * Add ICE candidate manually.
   */
  handleAddIceCandidate() {
    const cand = this.data.remoteSdpInput.trim();
    if (!cand) {
      this.showToast('请输入 ICE Candidate');
      return;
    }
    try {
      const parsed = JSON.parse(cand);
      this.manager?.addIceCandidate(parsed);
      this.setData((prev: SignalPageData) => ({
        iceCandidates: [...prev.iceCandidates, cand],
      }));
      this.showToast('ICE Candidate 已添加');
    } catch {
      this.showToast('ICE Candidate 格式错误，请输入 JSON');
    }
  },

  /**
   * Copy SDP to clipboard.
   */
  handleCopySdp() {
    const sdp = this.data.offerSdp || this.data.answerSdp;
    if (!sdp) return;
    wx.setClipboardData({
      data: sdp,
      success: () => this.showToast('已复制到剪贴板'),
    });
  },

  /**
   * Toggle manual SDP exchange mode.
   */
  toggleManualExchange() {
    this.setData((prev: SignalPageData) => ({
      showManualExchange: !prev.showManualExchange,
    }));
  },

  cleanup() {
    stopWebRTC();
    this.manager = null;
  },

  showToast(text: string) {
    this.setData({ toastText: text, toastVisible: true });
    setTimeout(() => this.setData({ toastVisible: false }), 2500);
  },

  onOfferInput(e: any) {
    this.setData({ localSdpInput: e.detail.value });
  },

  onRemoteSdpInput(e: any) {
    this.setData({ remoteSdpInput: e.detail.value });
  },
});
