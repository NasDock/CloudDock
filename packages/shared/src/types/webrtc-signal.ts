// WebRTC signaling message types (deviceId-based routing)

export type WebRTCSignalType =
  | 'signal_ready'
  | 'offer'
  | 'answer'
  | 'ice'
  | 'bye'
  | 'signal_error';

export interface WebRTCSignalMessage {
  type: WebRTCSignalType;
  id: string;
  deviceId: string;
  from?: 'nas' | 'mobile';
  data?: unknown;
}

export interface WebRTCOfferPayload {
  sdp: string;
}

export interface WebRTCAnswerPayload {
  sdp: string;
}

export interface WebRTCIcePayload {
  candidate: string;
  sdpMid?: string;
  sdpMLineIndex?: number;
}

