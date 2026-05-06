import apiClient from './client';

export interface UpdateProfileParams {
  username: string;
}

export interface ChangePasswordParams {
  oldPassword: string;
  newPassword: string;
}

export const userApi = {
  async updateProfile(params: UpdateProfileParams) {
    const res = await apiClient.put('/user/profile', params);
    return res.data;
  },

  async changePassword(params: ChangePasswordParams) {
    const res = await apiClient.put('/user/password', params);
    return res.data;
  },
};
