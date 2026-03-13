import { api, getApiData } from './client';

export interface User {
  uuid: string;
  name: string;
  email: string;
}

export interface LoginResponse {
  user: User;
  access_token?: string;
  token_type: string;
  expires_in: number;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await api.post<{ data: LoginResponse }>('/auth/login', { email, password, platform: 'web' });
  const data = getApiData(res);
  if (!data?.user) throw new Error('Login failed');
  return data;
}

export async function me(): Promise<User> {
  const res = await api.get<{ data: User }>('/auth/me');
  const data = getApiData(res);
  if (!data) throw new Error('Not authenticated');
  return data;
}
