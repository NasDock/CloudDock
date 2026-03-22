import { useEffect, useRef, useCallback } from 'react';
import { useTunnelStore } from '@/stores/tunnelStore';
import { getAccessToken } from '@/api/client';
import type { WSMessage } from '@cloud-dock/shared';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws/device';
const HEARTBEAT_INTERVAL = 30_000;
const HEARTBEAT_TIMEOUT = 10_000;

export const useWebSocket = () => {
  const { setWsConnected, tunnels } = useTunnelStore();
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const messageHandlers = useRef<Map<string, (data: any) => void>>(new Map());
  const pendingMessages = useRef<Map<string, { resolve: (data: any) => void; reject: (err: Error) => void }>>(new Map());
  const messageId = useRef(0);

  const generateMessageId = () => `msg_${Date.now()}_${++messageId.current}`;

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const msg: WSMessage = JSON.parse(event.data);

      // Handle responses to pending messages
      if (msg.id && pendingMessages.current.has(msg.id)) {
        const { resolve } = pendingMessages.current.get(msg.id)!;
        pendingMessages.current.delete(msg.id);
        resolve(msg.data);
        return;
      }

      // Route to registered handlers
      const handler = messageHandlers.current.get(msg.type);
      if (handler) {
        handler(msg.data);
      }

      // Built-in handlers
      switch (msg.type) {
        case 'heartbeat':
          sendMessage({ type: 'heartbeat_ack', id: msg.id, data: { ts: Date.now() } });
          break;
        case 'tunnel_status':
          // Update tunnel status in store
          break;
        case 'auth_success':
          setWsConnected(true);
          reconnectAttempts.current = 0;
          break;
        case 'auth_error':
          setWsConnected(false);
          wsRef.current?.close();
          break;
      }
    } catch (err) {
      console.error('Failed to parse WS message:', err);
    }
  }, [setWsConnected]);

  const sendMessage = useCallback((msg: Partial<WSMessage>): Promise<any> | null => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return null;
    }

    const fullMsg = { ...msg, id: msg.id || generateMessageId() };

    if (msg.id) {
      return new Promise((resolve, reject) => {
        pendingMessages.current.set(fullMsg.id!, { resolve, reject });
        ws.send(JSON.stringify(fullMsg));

        // Timeout for pending message
        setTimeout(() => {
          if (pendingMessages.current.has(fullMsg.id!)) {
            pendingMessages.current.delete(fullMsg.id!);
            reject(new Error('Message timeout'));
          }
        }, 10_000);
      });
    }

    ws.send(JSON.stringify(fullMsg));
    return null;
  }, []);

  const connect = useCallback(() => {
    const token = getAccessToken();
    if (!token) {
      setWsConnected(false);
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      reconnectAttempts.current = 0;

      // Start heartbeat
      heartbeatTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          const id = generateMessageId();
          ws.send(JSON.stringify({ type: 'heartbeat', id, data: { ts: Date.now() } }));

          // Set timeout for heartbeat response
          heartbeatTimeoutRef.current = setTimeout(() => {
            console.warn('Heartbeat timeout, reconnecting...');
            ws.close();
          }, HEARTBEAT_TIMEOUT);
        }
      }, HEARTBEAT_INTERVAL);
    };

    ws.onmessage = (event) => {
      // Clear heartbeat timeout on any message
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
        heartbeatTimeoutRef.current = null;
      }
      handleMessage(event);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = (event) => {
      setWsConnected(false);

      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
        heartbeatTimeoutRef.current = null;
      }

      // Reconnect with exponential backoff
      if (event.code !== 1000 && event.code !== 4000) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 300_000);
        reconnectAttempts.current++;
        reconnectTimerRef.current = setTimeout(connect, delay);
      }
    };
  }, [setWsConnected, handleMessage]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close(1000);
      wsRef.current = null;
    }
    setWsConnected(false);
  }, [setWsConnected]);

  const registerHandler = useCallback((type: string, handler: (data: any) => void) => {
    messageHandlers.current.set(type, handler);
    return () => {
      messageHandlers.current.delete(type);
    };
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected: useTunnelStore.getState().wsConnected,
    connect,
    disconnect,
    sendMessage,
    registerHandler,
  };
};
