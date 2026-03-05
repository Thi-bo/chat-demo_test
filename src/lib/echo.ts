import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

declare global {
  interface Window {
    Pusher: typeof Pusher;
    Echo?: Echo;
  }
}

const key = import.meta.env.VITE_REVERB_APP_KEY || 'local-key';
const wsHost = import.meta.env.VITE_REVERB_HOST || 'localhost';
const wsPort = import.meta.env.VITE_REVERB_PORT || '8080';
const scheme = import.meta.env.VITE_REVERB_SCHEME === 'https' ? 'https' : 'http';

window.Pusher = Pusher;

export function getEcho(): Echo | null {
  if (window.Echo) return window.Echo;
  const token = localStorage.getItem('access_token');
  if (!token) return null;
  window.Echo = new Echo({
    broadcaster: 'reverb',
    key,
    wsHost,
    wsPort: Number(wsPort),
    wssPort: Number(wsPort),
    forceTLS: scheme === 'https',
    enabledTransports: ['ws', 'wss'],
    authorizer: (channel: { name: string }) => ({
      authorize: (socketId: string, callback: (a: boolean, d?: { auth: string }) => void) => {
        fetch('/broadcasting/auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
          body: JSON.stringify({
            socket_id: socketId,
            channel_name: channel.name,
          }),
        })
          .then((r) => r.json())
          .then((data) => callback(false, { auth: data.auth ?? '' }))
          .catch(() => callback(true));
      },
    }),
  });
  return window.Echo;
}

export function subscribeConversation(conversationUuid: string, onMessage: (payload: unknown) => void) {
  const echo = getEcho();
  if (!echo) return () => {};
  const channel = echo.private(`conversation.${conversationUuid}`);
  channel.listen('.message.sent', onMessage);
  return () => channel.stopListening('.message.sent');
}
