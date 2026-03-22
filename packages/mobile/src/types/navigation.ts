import type { NativeStackScreenProps } from 'expo-router';

export type RootStackParamList = {
  '(auth)': undefined;
  '(tabs)': undefined;
  'tunnel-detail': { tunnelId: string };
  'tunnel-create': undefined;
  'qr-scan': undefined;
};

export type AuthStackParamList = {
  login: undefined;
  register: undefined;
};

export type TabStackParamList = {
  index: undefined;
  tunnels: undefined;
  devices: undefined;
  profile: undefined;
};

export type TunnelDetailParams = {
  'tunnel-detail': { tunnelId: string };
};

declare global {
  namespace ExpoRouter {
    interface RouterOptions {
      params?: Record<string, unknown>;
    }
  }
}
