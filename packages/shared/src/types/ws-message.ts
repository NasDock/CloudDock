// WebSocket message types - shared between server and NAS client
export interface WSMessage {
  type: string;
  id: string;
  data?: unknown;
}

export interface WSAuthSuccess {
  deviceId: string;
  tunnels: Array<{
    tunnelId: string;
    name: string;
    protocol: string;
    localAddress: string;
  }>;
}

export interface WSAuthError {
  reason: string;
}

export interface WSHeartbeat {
  ts: number;
}

export interface WSTunnelOpen {
  tunnelId: string;
  localAddress: string;
  protocol: 'http' | 'tcp' | 'udp';
}

export interface WSTunnelOpenAck {
  tunnelId: string;
  status: 'open' | 'error';
  publicPath?: string;
  reason?: string;
}

export interface WSTunnelData {
  tunnelId: string;
  requestId: string;
  method?: string;
  path?: string;
  headers?: Record<string, string>;
  body?: string;
  timestamp: number;
  statusCode?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
}

export interface WSTunnelBinary {
  tunnelId: string;
  requestId: string;
  data: string; // base64-encoded raw IP packet
  timestamp: number;
}

export interface WSBindRequest {
  bindToken: string;
  userToken: string;
}

export interface WSBindConfirm {
  bindToken: string;
  username: string;
  deviceName: string;
}

export interface WSBindConfirmAck {
  accepted: boolean;
  deviceName?: string;
}

export type WSClientMessageType =
  | 'heartbeat_ack'
  | 'tunnel_open'
  | 'tunnel_data'
  | 'tunnel_data_ack'
  | 'bind_request'
  | 'bind_confirm_ack';

export type WSServerMessageType =
  | 'auth_success'
  | 'auth_error'
  | 'heartbeat'
  | 'tunnel_open_ack'
  | 'tunnel_close'
  | 'tunnel_data'
  | 'tunnel_status'
  | 'bind_confirm';
