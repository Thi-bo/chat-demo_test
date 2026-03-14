import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

type EchoReverb = Echo<'reverb'>;

declare global {
  interface Window {
    Pusher: typeof Pusher;
    Echo?: EchoReverb;
  }
}

const key = import.meta.env.VITE_REVERB_APP_KEY || 'local-key';
const wsHost = import.meta.env.VITE_REVERB_HOST || 'localhost';
const wsPort = import.meta.env.VITE_REVERB_PORT || '8081';
const scheme = import.meta.env.VITE_REVERB_SCHEME === 'https' ? 'https' : 'http';

window.Pusher = Pusher;

/** Token Sanctum (Bearer) optionnel. Si absent, l'auth se fait par cookies (connexion web). */
let authToken: string | null = null;

export function setEchoAuthToken(token: string | null): void {
  authToken = token;
  if (window.Echo) {
    (window.Echo as EchoReverb & { conn?: { pusher?: { disconnect: () => void } } })?.conn?.pusher?.disconnect?.();
    window.Echo = undefined;
  }
}

function getXsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function getEcho(token?: string | null): EchoReverb | null {
  const t = token !== undefined ? token : authToken;

  if (window.Echo) {
    return window.Echo;
  }

  const useCookieAuth = !t;
  const broadcastAuthUrl = '/api/broadcasting/auth';

  window.Echo = new Echo({
    broadcaster: 'reverb',
    key,
    wsHost,
    wsPort: Number(wsPort),
    wssPort: Number(wsPort),
    forceTLS: scheme === 'https',
    enabledTransports: ['ws', 'wss'],
    authEndpoint: broadcastAuthUrl,
    authorizer: (channel: { name: string }) => ({
      authorize: (socketId: string, callback: (err: boolean, data?: { auth: string }) => void) => {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        };
        if (t) {
          headers['Authorization'] = `Bearer ${t}`;
        }
        const xsrf = getXsrfToken();
        if (xsrf) headers['X-XSRF-TOKEN'] = xsrf;

        fetch(broadcastAuthUrl, {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify({
            socket_id: socketId,
            channel_name: channel.name,
          }),
        })
          .then((r) => {
            if (!r.ok) {
              return r.text().then((text) => {
                throw new Error(`Broadcast auth ${r.status}: ${text}`);
              });
            }
            return r.json();
          })
          .then((data) => {
            callback(false, { auth: data.auth ?? '' });
          })
          .catch((err) => {
            console.error('[Echo] Channel auth failed:', channel.name, err);
            callback(true);
          });
      },
    }),
  });

  console.log('[Echo] Initialized Reverb', { wsHost, wsPort, key, auth: useCookieAuth ? 'cookie' : 'bearer' });
  return window.Echo;
}

export interface MessageSentPayload {
  uuid: string;
  conversation_uuid: string;
  user_uuid: string;
  user_name: string;
  body: string;
  type: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface ConversationUpdatedPayload {
  action: string;
  [key: string]: unknown;
}

export type Unsubscribe = () => void;

export function subscribeConversation(
  conversationUuid: string,
  callbacks: {
    onMessage?: (payload: MessageSentPayload) => void;
    onConversationUpdated?: (payload: ConversationUpdatedPayload) => void;
  }
): Unsubscribe {
  const echo = getEcho();
  if (!echo) {
    console.error('[Echo] Cannot subscribe: no Echo (login with platform=mobile)');
    return () => {};
  }

  const channel = echo.private(`conversation.${conversationUuid}`);

  if (callbacks.onMessage) {
    channel.listen('.message.sent', (payload: MessageSentPayload) => {
      callbacks.onMessage?.(payload);
    });
  }
  if (callbacks.onConversationUpdated) {
    channel.listen('.conversation.updated', (payload: ConversationUpdatedPayload) => {
      callbacks.onConversationUpdated?.(payload);
    });
  }

  return () => {
    channel.stopListening('.message.sent');
    channel.stopListening('.conversation.updated');
  };
}
