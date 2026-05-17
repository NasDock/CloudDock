declare module '@roamhq/wrtc' {
  export class RTCPeerConnection {
    constructor(config?: any);
    createDataChannel(label: string, options?: any): any;
    createOffer(options?: any): Promise<{ sdp: string }>;
    createAnswer(options?: any): Promise<{ sdp: string }>;
    setLocalDescription(desc: any): Promise<void>;
    setRemoteDescription(desc: any): Promise<void>;
    addIceCandidate(candidate: any): Promise<void>;
    close(): void;
    onicecandidate: ((ev: any) => void) | null;
    ondatachannel: ((ev: any) => void) | null;
    onconnectionstatechange: ((ev: any) => void) | null;
    connectionState: string;
  }

  export class RTCSessionDescription {
    constructor(init: any);
    sdp: string;
    type: string;
  }

  export class RTCIceCandidate {
    constructor(init: any);
  }
}
