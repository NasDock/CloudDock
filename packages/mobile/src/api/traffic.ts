import api from './client';
import type { UserTrafficStatistics } from '@cloud-dock/shared';

export const trafficApi = {
  getStats: async (): Promise<UserTrafficStatistics> => {
    const response = await api.get<{ success: true; data: UserTrafficStatistics }>('/traffic/stats');
    return response.data.data!;
  },
};
