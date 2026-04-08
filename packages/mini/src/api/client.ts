const DEFAULT_API_BASE_URL = 'https://cloud.audiodock.cn';
const API_BASE_URL_KEY = 'apiBaseUrl';

let apiBaseUrl = DEFAULT_API_BASE_URL;

function normalizeApiBaseUrl(input: string): string {
  let url = input.trim();
  if (!url) return DEFAULT_API_BASE_URL;
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  url = url.replace(/\/+$/, '');
  if (!/\/api$/i.test(url)) {
    url = `${url}/api`;
  }
  return url;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

export function setApiBaseUrl(input: string, persist = true): string {
  apiBaseUrl = normalizeApiBaseUrl(input);
  if (persist) {
    wx.setStorageSync(API_BASE_URL_KEY, apiBaseUrl);
  }
  return apiBaseUrl;
}

export function getApiBaseUrl(): string {
  return apiBaseUrl;
}

export async function initApiBaseUrl(): Promise<string> {
  const stored = wx.getStorageSync(API_BASE_URL_KEY);
  if (stored) {
    apiBaseUrl = stored;
  }
  return apiBaseUrl;
}

function getRequestDeviceHeaders(): Record<string, string> {
  const platform = 'wechat-miniprogram';
  const name = 'MiniProgram';
  return {
    'x-request-device-platform': platform,
    'x-request-device-name': name,
  };
}

export interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  data?: any;
  params?: Record<string, unknown>;
  header?: Record<string, string>;
}

export async function request<T = unknown>(options: RequestOptions): Promise<T> {
  const { url, method = 'GET', data, params, header = {} } = options;

  const fullUrl = apiBaseUrl + url;

  // Add auth header
  const token = wx.getStorageSync('accessToken');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getRequestDeviceHeaders(),
    ...header,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return new Promise((resolve, reject) => {
    const requestTask = wx.request({
      url: fullUrl,
      method,
      data,
      params,
      header: headers,
      timeout: 30000,
      success: async (res) => {
        const statusCode = res.statusCode;

        // Handle 401 - token refresh
        if (statusCode === 401) {
          const refreshToken = wx.getStorageSync('refreshToken');
          if (refreshToken) {
            try {
              const refreshRes = await new Promise<{ accessToken: string }>((res, rej) => {
                wx.request({
                  url: `${apiBaseUrl}/auth/refresh`,
                  method: 'POST',
                  data: { refreshToken },
                  header: { 'Content-Type': 'application/json' },
                  success: (r) => {
                    const d = r.data as any;
                    if (d.success) res(d.data);
                    else rej(d.error);
                  },
                  fail: rej,
                });
              });
              wx.setStorageSync('accessToken', refreshRes.accessToken);
              // Retry original request with new token
              const retryHeaders = { ...headers, Authorization: `Bearer ${refreshRes.accessToken}` };
              const retryTask = wx.request({
                url: fullUrl,
                method,
                data,
                params,
                header: retryHeaders,
                timeout: 30000,
                success: (r) => {
                  const responseData = r.data as ApiResponse<T>;
                  if (responseData.success) {
                    resolve(responseData.data as T);
                  } else {
                    reject(responseData.error);
                  }
                },
                fail: reject,
              });
              return;
            } catch {
              wx.removeStorageSync('accessToken');
              wx.removeStorageSync('refreshToken');
              reject({ code: 'UNAUTHORIZED', message: '认证失败，请重新登录' });
              return;
            }
          }
          reject({ code: 'UNAUTHORIZED', message: '未登录' });
          return;
        }

        const responseData = res.data as ApiResponse<T>;
        if (statusCode >= 200 && statusCode < 300 && responseData.success) {
          resolve((responseData as ApiSuccessResponse<T>).data as T);
        } else if (statusCode >= 200 && statusCode < 300) {
          resolve(responseData as T);
        } else {
          const err = (responseData as ApiErrorResponse).error || {
            code: 'UNKNOWN',
            message: `请求失败 (${statusCode})`,
          };
          reject(err);
        }
      },
      fail: (err) => {
        reject({ code: 'NETWORK_ERROR', message: err.errMsg || '网络请求失败' });
      },
    });
  });
}

export default { request, setApiBaseUrl, getApiBaseUrl, initApiBaseUrl };
