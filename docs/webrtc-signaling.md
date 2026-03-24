# WebRTC Signaling Protocol (DeviceId Routing)

## Overview
- Signaling path: `WS /ws/signal`
- Routing key: `deviceId` (same as `clientId` in DB)
- Auth:
  - NAS: `clientKey`
  - Mobile: JWT `token` (userId bound)
- No rooms; point-to-point only.

## Connect
### NAS
`wss://<server>/ws/signal?deviceId=<clientId>&clientKey=<clientKey>&role=nas`

### Mobile
`wss://<server>/ws/signal?deviceId=<clientId>&token=<JWT>&role=mobile`

## Message Envelope
```json
{
  "type": "offer|answer|ice|bye|signal_ready",
  "id": "sig_...",
  "deviceId": "clientId",
  "data": { }
}
```

Server forwards messages to the peer and adds:
```json
{ "from": "nas" | "mobile" }
```

## Payloads
### offer
```json
{ "type": "offer", "data": { "sdp": "..." } }
```

### answer
```json
{ "type": "answer", "data": { "sdp": "..." } }
```

### ice
```json
{ "type": "ice", "data": { "candidate": "...", "sdpMid": "0", "sdpMLineIndex": 0 } }
```

### bye
```json
{ "type": "bye" }
```

## Fallback Strategy
- WebRTC is used for large data (audio/video/file streams).
- Small requests continue through existing HTTP/WS.
- If WebRTC is not ready, clients automatically fall back to tunnel.

## DataChannel (Large Payload) Protocol
Messages are JSON text frames for portability.

### file_chunk
```json
{
  "type": "file_chunk",
  "meta": {
    "transferId": "file_123",
    "name": "video.mp4",
    "mime": "video/mp4",
    "size": 123456,
    "chunkSize": 32768,
    "chunkCount": 4
  },
  "index": 0,
  "data": "base64..."
}
```

### file_complete
```json
{
  "type": "file_complete",
  "meta": {
    "transferId": "file_123",
    "size": 123456,
    "chunkSize": 32768,
    "chunkCount": 4
  }
}
```
