// WebRTC data channel payloads for large data transfer

export type WebRTCDataType = 'file_chunk' | 'file_complete' | 'file_error' | 'ip_packet' | 'vpn_control';

export interface WebRTCFileMeta {
  transferId: string;
  name?: string;
  mime?: string;
  size: number;
  chunkSize: number;
  chunkCount: number;
}

export interface WebRTCFileChunk {
  type: 'file_chunk';
  meta: WebRTCFileMeta;
  index: number;
  // base64-encoded chunk (portable across JS runtimes)
  data: string;
}

export interface WebRTCFileComplete {
  type: 'file_complete';
  meta: WebRTCFileMeta;
}

export interface WebRTCFileError {
  type: 'file_error';
  meta: WebRTCFileMeta;
  message: string;
}

// VPN IP packet over WebRTC data channel
export interface WebRTCIPPacket {
  type: 'ip_packet';
  // base64-encoded raw IP packet
  data: string;
}

// VPN control messages (ip assignment, route updates, etc.)
export type VPNControlAction = 'ip_assigned' | 'route_update' | 'heartbeat' | 'mtu_negotiate';

export interface WebRTCVPNControl {
  type: 'vpn_control';
  action: VPNControlAction;
  payload?: unknown;
}

export type WebRTCDataMessage = WebRTCFileChunk | WebRTCFileComplete | WebRTCFileError | WebRTCIPPacket | WebRTCVPNControl;

