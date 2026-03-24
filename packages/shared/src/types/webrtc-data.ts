// WebRTC data channel payloads for large data transfer

export type WebRTCDataType = 'file_chunk' | 'file_complete' | 'file_error';

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

export type WebRTCDataMessage = WebRTCFileChunk | WebRTCFileComplete | WebRTCFileError;

