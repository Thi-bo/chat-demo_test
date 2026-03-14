import { useState, useEffect, useCallback } from 'react';
import { setEchoAuthToken, getEcho, subscribeConversation } from './lib/echo';
import type { MessageSentPayload } from './lib/echo';
import * as api from './lib/api';
import { setApiToken } from './lib/api';

const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const isRemoteApi = Boolean(apiBase && !apiBase.includes('localhost') && !apiBase.includes('127.0.0.1'));

function Login({ onLogin }: { onLogin: (user: api.User, token: string | null) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const platform = isRemoteApi ? 'mobile' : 'web';
      const result = await api.login(email, password, platform);
      onLogin(result.user, result.token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Connexion échouée');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <h1 style={{ textAlign: 'center', marginBottom: '1rem' }}>NutritionTV – Chat demo</h1>
      <form className="login-form" onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={loading}>
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
      <p style={{ textAlign: 'center', color: '#71717a', fontSize: '0.9rem' }}>
        {isRemoteApi ? (
          <>Connexion <strong>token</strong> (recommandé depuis local vers l’API distante).</>
        ) : (
          <>Connexion <strong>web</strong> : cookies pour l’API et Reverb.</>
        )}
      </p>
    </div>
  );
}

function ConversationList({
  user,
  onSelect,
  onLogout,
}: {
  user: api.User;
  onSelect: (c: api.Conversation) => void;
  onLogout: () => void;
}) {
  const [conversations, setConversations] = useState<api.Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getConversationsAndGroups()
      .then(setConversations)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erreur'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="app">
      <header className="header">
        <h1>Conversations</h1>
        <span className="user">{user.name}</span>
        <button type="button" onClick={onLogout}>
          Déconnexion
        </button>
      </header>
      {loading && <p>Chargement…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && conversations.length === 0 && (
        <p style={{ color: '#71717a' }}>Aucune conversation. Créez-en une via l’API ou un autre client.</p>
      )}
      <ul className="conv-list">
        {conversations.map((c) => (
          <li key={c.uuid} onClick={() => onSelect(c)}>
            <div className="name">
              {c.type === 'group' || c.type === 'salon' ? '👥 ' : ''}
              {c.name || (c.type === 'direct' ? 'Conversation' : 'Groupe')}
            </div>
            <div className="meta">
              {c.last_message?.body?.slice(0, 50) || '—'} · {new Date(c.updated_at).toLocaleString()}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChatView({
  user,
  conversation,
  onBack,
}: {
  user: api.User;
  conversation: api.Conversation;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<api.Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const appendMessage = useCallback((msg: api.Message | MessageSentPayload) => {
    setMessages((prev) => {
      const exists = prev.some((m) => m.uuid === msg.uuid);
      if (exists) return prev;
      const name = 'user_name' in msg ? msg.user_name : (msg as api.Message).user_name ?? (msg as api.Message).user?.name;
      return [
        ...prev,
        {
          uuid: msg.uuid,
          body: msg.body,
          type: msg.type || 'text',
          user_uuid: msg.user_uuid,
          user_name: name,
          user: name ? { name: String(name) } : undefined,
          created_at: msg.created_at,
        } as api.Message,
      ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });
  }, []);

  useEffect(() => {
    api
      .getMessages(conversation.uuid)
      .then((res) => setMessages((res.data || []).reverse()))
      .finally(() => setLoading(false));
  }, [conversation.uuid]);

  useEffect(() => {
    getEcho();
    const unsub = subscribeConversation(conversation.uuid, {
      onMessage: (payload) => appendMessage(payload),
      onConversationUpdated: (payload) => {
        console.log('[WS] conversation.updated', payload);
      },
    });
    return () => unsub();
  }, [conversation.uuid, appendMessage]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = input.trim();
    if (!body || sending) return;
    setSending(true);
    setInput('');
    try {
      const msg = await api.sendMessage(conversation.uuid, body);
      appendMessage(msg);
    } catch (err) {
      console.error(err);
      setInput(body);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="app">
      <a href="#" className="back-link" onClick={(e) => { e.preventDefault(); onBack(); }}>
        ← Retour aux conversations
      </a>
      <div className="chat-header">{conversation.name || 'Conversation'}</div>
      <div className="messages">
        {loading && <span>Chargement…</span>}
        {messages.map((m) => (
          <div
            key={m.uuid}
            className={`message ${m.user_uuid === user.uuid ? 'mine' : ''}`}
          >
            <div className="sender">{m.user_name ?? m.user?.name ?? 'Inconnu'}</div>
            <div className="body">{m.body}</div>
            <div className="time">{new Date(m.created_at).toLocaleTimeString()}</div>
          </div>
        ))}
      </div>
      <div className="realtime-badge">Temps réel activé (Reverb)</div>
      <form className="send-form" onSubmit={send}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Écrire un message…"
          disabled={sending}
        />
        <button type="submit" disabled={sending || !input.trim()}>
          Envoyer
        </button>
      </form>
    </div>
  );
}

function readStoredAuth(): { user: api.User; token: string | null } | null {
  const u = sessionStorage.getItem('chat_demo_user');
  if (!u) return null;
  try {
    const user = JSON.parse(u);
    const token = sessionStorage.getItem('chat_demo_token');
    return { user, token: token || null };
  } catch {
    return null;
  }
}

export default function App() {
  const [user, setUser] = useState<api.User | null>(() => readStoredAuth()?.user ?? null);
  const [token, setToken] = useState<string | null>(() => readStoredAuth()?.token ?? null);
  const [selected, setSelected] = useState<api.Conversation | null>(null);

  useEffect(() => {
    if (user) {
      setApiToken(token);
      setEchoAuthToken(token);
      getEcho(token ?? null);
    }
  }, [token, user]);

  const handleLogin = (u: api.User, t: string | null) => {
    setUser(u);
    setToken(t);
    setApiToken(t ?? null);
    setEchoAuthToken(t ?? null);
    getEcho(t ?? null);
    if (t) sessionStorage.setItem('chat_demo_token', t);
    sessionStorage.setItem('chat_demo_user', JSON.stringify(u));
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    setUser(null);
    setToken(null);
    setSelected(null);
    setApiToken(null);
    setEchoAuthToken(null);
    sessionStorage.removeItem('chat_demo_token');
    sessionStorage.removeItem('chat_demo_user');
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  if (selected) {
    return (
      <ChatView
        user={user}
        conversation={selected}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <ConversationList
      user={user}
      onSelect={setSelected}
      onLogout={handleLogout}
    />
  );
}
