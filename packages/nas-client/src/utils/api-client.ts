import { NASConfig } from './config-store.js';

export interface ClientLoginResponse {
  success: boolean;
  data?: {
    deviceId: string;
    deviceName: string;
    bindToken: string;
    status: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export class ApiClient {
  private baseUrl: string;

  constructor(serverUrl: string) {
    // Extract host:port from ws://localhost:3300 -> http://localhost:3300
    this.baseUrl = serverUrl.replace(/^ws:\/\//, 'http://').replace(/\/ws.*$/, '');
  }

  async clientLogin(email: string, password: string, deviceName?: string): Promise<ClientLoginResponse> {
    const url = `${this.baseUrl}/api/client/login`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, deviceName }),
    });
    return res.json();
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }
}
