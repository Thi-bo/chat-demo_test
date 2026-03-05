import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import * as api from '../api/conversations';
import type { Conversation, Message } from '../api/conversations';
import { subscribeConversation } from '../lib/echo';

interface IncomingCall {
  conversation_uuid: string;
  caller_uuid: string;
  caller_name: string;
  room_name: string;
  call_type: 'audio' | 'video';
}

export default function Chat() {
  const { conversationUuid } = useParams<{ conversationUuid: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loadConversation = useCallback(async () => {
    if (!conversationUuid) return;
    try {
      const conv = await api.getConversation(conversationUuid);
      setConversation(conv);
    } catch {
      setConversation(null);
    }
  }, [conversationUuid]);

  const loadMessages = useCallback(async () => {
    if (!conversationUuid) return;
    try {
      const { list } = await api.getMessages(conversationUuid);
      setMessages(list);
      api.markRead(conversationUuid);
    } catch {
      setMessages([]);
    }
  }, [conversationUuid]);

  useEffect(() => {
    if (!conversationUuid) return;
    setLoading(true);
    Promise.all([loadConversation(), loadMessages()]).finally(() => setLoading(false));
  }, [conversationUuid, loadConversation, loadMessages]);

  useEffect(() => {
    if (!conversationUuid) return;
    const unsub = subscribeConversation(conversationUuid, (payload: unknown) => {
      const p = payload as { uuid?: string; body?: string; user_uuid?: string; user_name?: string; created_at?: string };
      setMessages((prev) => {
        if (p.uuid && prev.some((m) => m.uuid === p.uuid)) return prev;
        return [
          ...prev,
          {
            uuid: p.uuid ?? '',
            conversation_uuid: conversationUuid,
            user_id: null,
            user_uuid: p.user_uuid ?? null,
            user_name: p.user_name ?? null,
            body: p.body ?? '',
            type: 'text',
            metadata: null,
            created_at: p.created_at ?? new Date().toISOString(),
          },
        ];
      });
    });
    return unsub;
  }, [conversationUuid]);

  // Écouter les appels entrants
  useEffect(() => {
    if (!conversationUuid) return;
    
    import('../lib/echo').then(({ getEcho }) => {
      const echo = getEcho();
      if (!echo) return;
      
      const channel = echo.private(`conversation.${conversationUuid}`);
      
      channel.listen('.call.incoming', (data: IncomingCall) => {
        // Ne pas afficher la notification si c'est nous qui appelons
        if (data.caller_uuid !== user?.uuid) {
          setIncomingCall(data);
        }
      });

      // Écouter le typing indicator
      channel.listen('.user.typing', (data: { user_uuid: string; user_name: string }) => {
        if (data.user_uuid !== user?.uuid) {
          setTypingUsers((prev) => {
            if (prev.includes(data.user_name)) return prev;
            return [...prev, data.user_name];
          });
          
          // Supprimer après 3 secondes
          setTimeout(() => {
            setTypingUsers((prev) => prev.filter((name) => name !== data.user_name));
          }, 3000);
        }
      });

      return () => {
        channel.stopListening('.call.incoming');
        channel.stopListening('.user.typing');
      };
    });
  }, [conversationUuid, user?.uuid]);

  useEffect(() => {
    listRef.current?.scrollTo(0, listRef.current.scrollHeight);
  }, [messages]);

  const send = async () => {
    const body = input.trim();
    if (!body || !conversationUuid || sending) return;
    setSending(true);
    try {
      const msg = await api.sendMessage(conversationUuid, body);
      setMessages((prev) => [...prev, msg]);
      setInput('');
    } finally {
      setSending(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    
    // Envoyer typing indicator (avec debounce)
    if (conversationUuid && e.target.value.length > 0) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      api.sendTyping(conversationUuid).catch(() => {});
      
      typingTimeoutRef.current = setTimeout(() => {
        typingTimeoutRef.current = null;
      }, 1000);
    }
  };

  const startCall = (type: 'audio' | 'video') => {
    if (conversationUuid) {
      // Stocker le type d'appel dans sessionStorage pour CallRoom
      sessionStorage.setItem('call_type', type);
      navigate(`/call/${conversationUuid}`);
    }
  };

  const acceptCall = async () => {
    if (conversationUuid && incomingCall) {
      // Notifier qu'on accepte l'appel
      await api.answerCall(conversationUuid).catch(() => {});
      
      // Stocker le type d'appel
      sessionStorage.setItem('call_type', incomingCall.call_type);
      setIncomingCall(null);
      navigate(`/call/${conversationUuid}`);
    }
  };

  const rejectCall = async () => {
    if (conversationUuid) {
      // Notifier qu'on refuse l'appel
      await api.declineCall(conversationUuid).catch(() => {});
      setIncomingCall(null);
    }
  };

  if (loading || !conversation) {
    return (
      <div className="layout">
        <p>Chargement…</p>
        <Link to="/">Retour</Link>
      </div>
    );
  }

  return (
    <div className="layout" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Popup d'appel entrant */}
      {incomingCall && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#1e293b',
              padding: 32,
              borderRadius: 16,
              textAlign: 'center',
              maxWidth: 400,
            }}
          >
            <h2 style={{ marginBottom: 16, fontSize: 24 }}>
              {incomingCall.call_type === 'audio' ? '📞' : '📹'} Appel entrant
            </h2>
            <p style={{ marginBottom: 24, fontSize: 18 }}>
              <strong>{incomingCall.caller_name}</strong> vous appelle
            </p>
            <p style={{ marginBottom: 24, fontSize: 14, color: '#94a3b8' }}>
              Type : {incomingCall.call_type === 'audio' ? 'Audio uniquement' : 'Vidéo'}
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
              <button
                type="button"
                onClick={rejectCall}
                style={{
                  padding: '12px 24px',
                  borderRadius: 8,
                  background: '#dc2626',
                  fontSize: 16,
                  fontWeight: 'bold',
                }}
              >
                ❌ Refuser
              </button>
              <button
                type="button"
                onClick={acceptCall}
                style={{
                  padding: '12px 24px',
                  borderRadius: 8,
                  background: '#059669',
                  fontSize: 16,
                  fontWeight: 'bold',
                }}
              >
                ✅ Accepter
              </button>
            </div>
          </div>
        </div>
      )}

      <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, borderBottom: '1px solid #334155' }}>
        <Link to="/" style={{ color: '#38bdf8' }}>← Retour</Link>
        <strong>{conversation.type === 'group' ? conversation.name ?? 'Groupe' : 'Discussion'}</strong>
        <button 
          type="button" 
          onClick={() => startCall('audio')} 
          style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: 8, background: '#0891b2' }}
        >
          📞 Audio
        </button>
        <button 
          type="button" 
          onClick={() => startCall('video')} 
          style={{ padding: '8px 16px', borderRadius: 8, background: '#059669' }}
        >
          📹 Vidéo
        </button>
      </header>

      <div ref={listRef} style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.map((m) => (
          <div
            key={m.uuid}
            style={{
              alignSelf: m.user_uuid === user?.uuid ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
              padding: 10,
              borderRadius: 12,
              background: m.user_uuid === user?.uuid ? '#3b82f6' : '#334155',
            }}
          >
            {m.user_uuid !== user?.uuid && <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{m.user_name ?? 'Système'}</div>}
            <div>{m.body}</div>
            <div style={{ fontSize: 11, opacity: 0.8, marginTop: 4 }}>{new Date(m.created_at).toLocaleTimeString()}</div>
          </div>
        ))}
        
        {/* Indicateur "en train d'écrire" */}
        {typingUsers.length > 0 && (
          <div style={{ alignSelf: 'flex-start', padding: '8px 12px', fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
            {typingUsers.join(', ')} {typingUsers.length > 1 ? 'sont' : 'est'} en train d'écrire...
          </div>
        )}
      </div>

      <footer style={{ padding: 16, borderTop: '1px solid #334155' }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          style={{ display: 'flex', gap: 8 }}
        >
          <input
            type="text"
            placeholder="Message…"
            value={input}
            onChange={handleInputChange}
            style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid #334155' }}
          />
          <button type="submit" disabled={sending} style={{ padding: '12px 20px', borderRadius: 8, background: '#3b82f6' }}>
            Envoyer
          </button>
        </form>
      </footer>
    </div>
  );
}
