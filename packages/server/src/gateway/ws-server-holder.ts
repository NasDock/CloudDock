import { WSServer } from './ws-server.js';

let wsServerInstance: WSServer | null = null;

export function registerWSServer(ws: WSServer): void {
  wsServerInstance = ws;
}

export function getWSServer(): WSServer | null {
  return wsServerInstance;
}
