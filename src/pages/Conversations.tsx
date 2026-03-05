import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import * as api from '../api/conversations';
import type { Conversation } from '../api/conversations';

export default function Conversations() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDirectUuid, setCreateDirectUuid] = useState('');
  const [creating, setCreating] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  useEffect(() => {
    api
      .getConversations()
      .then(({ list: l }) => setList(l))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);

  // S'abonner au canal de présence
  useEffect(() => {
    import('../lib/echo').then(({ getEcho }) => {
      const echo = getEcho();
      if (!echo) return;
      
      const channel = echo.join('online-users');
      
      // Utilisateurs déjà en ligne
      channel.here((users: Array<{ uuid: string; name: string }>) => {
        console.log('👥 Utilisateurs en ligne:', users);
        setOnlineUsers(users.map((u) => u.uuid));
      });
      
      // Utilisateur se connecte
      channel.joining((user: { uuid: string; name: string }) => {
        console.log('✅ Utilisateur connecté:', user.name);
        setOnlineUsers((prev) => [...prev, user.uuid]);
      });
      
      // Utilisateur se déconnecte
      channel.leaving((user: { uuid: string; name: string }) => {
        console.log('❌ Utilisateur déconnecté:', user.name);
        setOnlineUsers((prev) => prev.filter((uuid) => uuid !== user.uuid));
      });

      return () => {
        channel.leave();
      };
    });
  }, []);

  const [error, setError] = useState<string | null>(null);

  const handleCreateDirect = async () => {
    if (!createDirectUuid.trim()) return;
    setError(null);
    setCreating(true);
    try {
      const conv = await api.getOrCreateDirect(createDirectUuid.trim());
      navigate(`/chat/${conv.uuid}`, { replace: true });
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
        : null;
      setError(msg || 'Impossible d’ouvrir la conversation.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="layout">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottom: '1px solid #334155' }}>
        <h1 style={{ margin: 0 }}>Conversations</h1>
        <span>{user?.name}</span>
        <button type="button" onClick={logout} style={{ padding: '8px 12px', borderRadius: 8, background: '#334155' }}>
          Déconnexion
        </button>
      </header>

      <div style={{ padding: 16 }}>
        <div style={{ marginBottom: 24 }}>
          <h3>Nouvelle conversation directe</h3>
          <p style={{ fontSize: 14, color: '#94a3b8' }}>Entrez l’UUID d’un autre utilisateur (ou utilisez le vôtre pour un 2e onglet)</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              type="text"
              placeholder="UUID utilisateur"
              value={createDirectUuid}
              onChange={(e) => setCreateDirectUuid(e.target.value)}
              style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #334155' }}
            />
            <button type="button" onClick={handleCreateDirect} disabled={creating} style={{ padding: '10px 16px', borderRadius: 8, background: '#3b82f6' }}>
              {creating ? '…' : 'Ouvrir'}
            </button>
          </div>
          <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Votre UUID : {user?.uuid}</p>
          {error && <p style={{ fontSize: 14, color: '#f87171', marginTop: 8 }}>{error}</p>}
        </div>

        <h3>Liste des conversations</h3>
        {loading ? (
          <p>Chargement…</p>
        ) : list.length === 0 ? (
          <p style={{ color: '#94a3b8' }}>Aucune conversation. Créez-en une ci‑dessus.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {list.map((c) => {
              // Extraire les UUIDs des autres participants
              const otherParticipants = c.participants?.filter((p) => p.user_uuid !== user?.uuid) ?? [];
              const isOnline = otherParticipants.some((p) => onlineUsers.includes(p.user_uuid));
              
              return (
                <li key={c.uuid} style={{ marginBottom: 8 }}>
                  <Link
                    to={`/chat/${c.uuid}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: 12,
                      borderRadius: 8,
                      background: '#1e293b',
                      textDecoration: 'none',
                      color: '#e2e8f0',
                    }}
                  >
                    {/* Indicateur de présence */}
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: isOnline ? '#10b981' : '#6b7280',
                        flexShrink: 0,
                      }}
                      title={isOnline ? 'En ligne' : 'Hors ligne'}
                    />
                    
                    <div style={{ flex: 1 }}>
                      <strong>{c.type === 'group' ? c.name ?? 'Groupe' : 'Direct'}</strong>
                      {c.participants?.length ? (
                        <span style={{ marginLeft: 8, color: '#94a3b8' }}>
                          – {c.participants.map((p) => p.user_name).join(', ')}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
