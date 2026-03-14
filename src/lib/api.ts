import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || '';

export const api = axios.create({
  baseURL: baseURL || undefined,
  withCredentials: true,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
});

export function setApiToken(token: string | null): void {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}

export interface User {
  uuid: string;
  name: string;
  email: string;
}

export interface Conversation {
  uuid: string;
  name: string | null;
  type: string;
  participants?: { user_uuid: string; user_name?: string }[];
  last_message?: { body: string; created_at: string };
  updated_at: string;
}

export interface Message {
  uuid: string;
  body: string;
  type: string;
  user_uuid: string;
  user_name?: string;
  user?: { name: string };
  created_at: string;
}

export type LoginResult = { user: User; token: string | null };

/** Connexion web (cookies) ou mobile (token dans la réponse). */
export async function login(
  email: string,
  password: string,
  platform: 'web' | 'mobile' = 'web'
): Promise<LoginResult> {
  const { data } = await api.post<{
    data: { user: User; access_token?: string; refresh_token?: string };
    success: boolean;
  }>('/api/auth/login', { email, password, platform });

  if (!data.success || !data.data?.user) {
    throw new Error('Login failed');
  }

  if (platform === 'mobile' && data.data.access_token) {
    return { user: data.data.user, token: data.data.access_token };
  }

  return { user: data.data.user, token: null };
}

export async function logout(): Promise<void> {
  await api.post('/api/auth/logout');
}

export async function getConversations(): Promise<Conversation[]> {
  const { data } = await api.get<{ data: { data: Conversation[] }; success: boolean }>('/api/conversations/discussions');
  return data.data?.data ?? [];
}

export async function getMessages(conversationUuid: string, cursor?: string): Promise<{
  data: Message[];
  next_cursor?: string;
}> {
  const params = cursor ? { cursor } : {};
  const { data } = await api.get<{ data: { data: Message[]; meta?: { next_cursor?: string } } }>(
    `/api/conversations/${conversationUuid}/messages`,
    { params }
  );
  const inner = data.data;
  return {
    data: inner?.data ?? [],
    next_cursor: inner?.meta?.next_cursor,
  };
}

export async function sendMessage(conversationUuid: string, body: string): Promise<Message> {
  const { data } = await api.post<{ data: Message; success: boolean }>(
    `/api/conversations/${conversationUuid}/messages`,
    { body }
  );
  return data.data;
}

export async function getOrCreateDirect(userUuid: string): Promise<Conversation> {
  const { data } = await api.post<{ data: Conversation; success: boolean }>('/api/conversations/direct', {
    user_uuid: userUuid,
  });
  return data.data;
}
