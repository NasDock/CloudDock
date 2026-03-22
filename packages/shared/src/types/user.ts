// User types
export type Plan = 'free' | 'pro' | 'enterprise';

export interface User {
  userId: string;
  email: string;
  username: string;
  plan: Plan;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPublic {
  userId: string;
  email: string;
  username: string;
  plan: Plan;
  createdAt: string;
}
