import { api, getApiData } from './client';

export interface Participant {
  uuid: string;
  user_uuid: string;
  user_name: string;
  role: string;
  last_read_at: string | null;
}

export interface Conversation {
  uuid: string;
  type: 'direct' | 'group';
  name: string | null;
  created_by: number | null;
  participants?: Participant[];
  updated_at: string;
}

export interface Message {
  uuid: string;
  conversation_uuid: string;
  user_id: number | null;
  user_uuid: string | null;
  user_name: string | null;
  body: string;
  type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export async function getConversations(cursor?: string) {
  const res = await api.get<{ data: Conversation[] | { data: Conversation[]; meta: Record<string, unknown> }; meta?: Record<string, unknown> }>(
    '/conversations',
    { params: { cursor, per_page: 20 } }
  );
  const payload = res.data?.data;
  const list = Array.isArray(payload) ? payload : payload?.data ?? [];
  const meta = (payload && !Array.isArray(payload) ? payload.meta : res.data?.meta) ?? {};
  return { list, meta };
}

export async function getOrCreateDirect(userUuid: string): Promise<Conversation> {
  const res = await api.post<{ data: Conversation }>('/conversations/direct', { user_uuid: userUuid });
  const data = getApiData(res);
  if (!data) throw new Error('Failed to get conversation');
  return data;
}

export async function createGroup(name: string, memberUuids: string[]): Promise<Conversation> {
  const res = await api.post<{ data: Conversation }>('/conversations/groups', { name, member_uuids: memberUuids });
  const data = getApiData(res);
  if (!data) throw new Error('Failed to create group');
  return data;
}

export async function getConversation(uuid: string): Promise<Conversation> {
  const res = await api.get<{ data: Conversation }>(`/conversations/${uuid}`);
  const data = getApiData(res);
  if (!data) throw new Error('Conversation not found');
  return data;
}

export async function getMessages(conversationUuid: string, cursor?: string) {
  const res = await api.get<{ data: Message[] | { data: Message[]; meta: Record<string, unknown> }; meta?: Record<string, unknown> }>(
    `/conversations/${conversationUuid}/messages`,
    { params: { cursor, per_page: 30 } }
  );
  const payload = res.data?.data;
  const list = Array.isArray(payload) ? payload : payload?.data ?? [];
  const meta = (payload && !Array.isArray(payload) ? payload.meta : res.data?.meta) ?? {};
  return { list, meta };
}

export async function sendMessage(conversationUuid: string, body: string, type = 'text'): Promise<Message> {
  const res = await api.post<{ data: Message }>(`/conversations/${conversationUuid}/messages`, { body, type });
  const data = getApiData(res);
  if (!data) throw new Error('Failed to send');
  return data;
}

export async function markRead(conversationUuid: string): Promise<void> {
  await api.post(`/conversations/${conversationUuid}/messages/read`);
}

export async function sendTyping(conversationUuid: string): Promise<void> {
  await api.post(`/conversations/${conversationUuid}/typing`);
}

export async function getLiveKitToken(conversationUuid: string, canPublish = true, callType: 'audio' | 'video' = 'video'): Promise<{
  token: string;
  room_name: string;
  livekit_url: string;
  room_uuid: string;
}> {
  const res = await api.post<{ data: { token: string; room_name: string; livekit_url: string; room_uuid: string } }>(
    `/conversations/${conversationUuid}/livekit/token`,
    { can_publish: canPublish, call_type: callType }
  );
  const data = getApiData(res);
  if (!data?.token) throw new Error('Failed to get LiveKit token');
  return data;
}

export async function answerCall(conversationUuid: string): Promise<void> {
  await api.post(`/conversations/${conversationUuid}/call/answer`);
}

export async function endCall(conversationUuid: string): Promise<void> {
  await api.post(`/conversations/${conversationUuid}/call/end`);
}

export async function declineCall(conversationUuid: string): Promise<void> {
  await api.post(`/conversations/${conversationUuid}/call/decline`);
}

export async function getUsersForDemo(): Promise<{ uuid: string; name: string; email: string }[]> {
  const res = await api.get<{ data: { user: { uuid: string; name: string; email: string } } }>('/auth/me');
  const meData = getApiData(res) as { user: { uuid: string; name: string; email: string } } | undefined;
  if (!meData?.user) return [];
  return [meData.user];
}
