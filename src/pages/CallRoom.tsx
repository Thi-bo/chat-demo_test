import { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Room, RoomEvent, Track, RemoteParticipant, RemoteTrack, RemoteTrackPublication } from 'livekit-client';
import * as api from '../api/conversations';

export default function CallRoom() {
  const { conversationUuid } = useParams<{ conversationUuid: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'connected' | 'error'>('loading');
  const [error, setError] = useState('');
  const roomRef = useRef<Room | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [participantsCount, setParticipantsCount] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  useEffect(() => {
    if (!conversationUuid) {
      setStatus('error');
      setError('Conversation manquante');
      return;
    }

    let room: Room | null = null;
    const localVideo = localVideoRef.current;
    const remoteVideo = remoteVideoRef.current;

    async function connect() {
      try {
        console.log('🔄 Obtention du token LiveKit...');
        
        // Récupérer le type d'appel depuis sessionStorage
        const callType = (sessionStorage.getItem('call_type') || 'video') as 'audio' | 'video';
        console.log('📞 Type d\'appel:', callType);
        
        const { token, livekit_url } = await api.getLiveKitToken(conversationUuid, true, callType);
        console.log('✅ Token obtenu, connexion à:', livekit_url);
        
        room = new Room();
        roomRef.current = room;

        // Gérer les tracks distantes
        room.on(RoomEvent.TrackSubscribed, (
          track: RemoteTrack,
          publication: RemoteTrackPublication,
          participant: RemoteParticipant
        ) => {
          console.log('📹 Track souscrite:', track.kind, 'de', participant.identity);
          if (track.kind === Track.Kind.Video && remoteVideo) {
            track.attach(remoteVideo);
          }
          if (track.kind === Track.Kind.Audio && remoteVideo) {
            track.attach(remoteVideo);
          }
        });

        room.on(RoomEvent.TrackUnsubscribed, () => {
          console.log('❌ Track désouscrite');
          if (remoteVideo && remoteVideo.srcObject) {
            (remoteVideo.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
            remoteVideo.srcObject = null;
          }
        });

        room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
          console.log('✅ Participant connecté:', participant.identity);
          setParticipantsCount((c) => c + 1);
        });

        room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
          console.log('❌ Participant déconnecté:', participant.identity);
          setParticipantsCount((c) => Math.max(0, c - 1));
        });

        // Connexion
        await room.connect(livekit_url, token, { autoSubscribe: true });
        console.log('✅ Connecté à LiveKit');
        setStatus('connected');

        // Activer caméra et micro selon le type d'appel
        console.log('📹 Activation du micro...');
        await room.localParticipant.setMicrophoneEnabled(true);
        
        if (callType === 'video') {
          console.log('📹 Activation de la caméra...');
          await room.localParticipant.setCameraEnabled(true);
        }

        // Attacher la vidéo locale si vidéo
        if (callType === 'video') {
          setTimeout(() => {
            const videoTrack = Array.from(room!.localParticipant.videoTrackPublications.values())[0]?.track;
            if (videoTrack && localVideo) {
              console.log('📹 Attachement de la vidéo locale');
              videoTrack.attach(localVideo);
            }
          }, 500);
        }

      } catch (e) {
        console.error('❌ Erreur LiveKit:', e);
        setError(e instanceof Error ? e.message : 'Erreur de connexion LiveKit');
        setStatus('error');
      }
    }

    connect();
    return () => {
      console.log('🔌 Déconnexion de la room');
      room?.disconnect(true);
      roomRef.current = null;
    };
  }, [conversationUuid]);

  // Écouter les événements d'appel (answered, ended)
  useEffect(() => {
    if (!conversationUuid) return;
    
    import('../lib/echo').then(({ getEcho }) => {
      const echo = getEcho();
      if (!echo) return;
      
      const channel = echo.private(`conversation.${conversationUuid}`);
      
      channel.listen('.call.answered', (data: { user_name: string }) => {
        console.log('✅ Appel accepté par:', data.user_name);
      });
      
      channel.listen('.call.ended', (data: { user_name: string; reason: string }) => {
        console.log('📞 Appel terminé par:', data.user_name, 'Raison:', data.reason);
        
        if (data.reason === 'declined') {
          alert(`${data.user_name} a refusé l'appel`);
        }
        
        // Retourner au chat
        setTimeout(() => {
          navigate(`/chat/${conversationUuid}`);
        }, 1000);
      });

      return () => {
        channel.stopListening('.call.answered');
        channel.stopListening('.call.ended');
      };
    });
  }, [conversationUuid, navigate]);

  const toggleMute = async () => {
    const r = roomRef.current;
    if (!r) return;
    const newState = !isMuted;
    await r.localParticipant.setMicrophoneEnabled(!newState);
    setIsMuted(newState);
    console.log('🎤 Micro:', newState ? 'coupé' : 'actif');
  };

  const toggleCamera = async () => {
    const r = roomRef.current;
    if (!r) return;
    const newState = !isCameraOff;
    await r.localParticipant.setCameraEnabled(!newState);
    setIsCameraOff(newState);
    console.log('📹 Caméra:', newState ? 'off' : 'on');
  };

  const hangUp = async () => {
    console.log('📞 Raccrochage');
    if (conversationUuid) {
      await api.endCall(conversationUuid).catch(() => {});
    }
    roomRef.current?.disconnect(true);
    navigate(`/chat/${conversationUuid}`);
  };

  if (status === 'error') {
    return (
      <div className="layout" style={{ padding: 24 }}>
        <h2 style={{ color: '#ef4444', marginBottom: 16 }}>❌ Erreur de connexion</h2>
        <p style={{ color: '#f87171', marginBottom: 8 }}>{error}</p>
        <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 24 }}>
          Vérifiez que :<br />
          - LIVEKIT_URL, LIVEKIT_API_KEY et LIVEKIT_API_SECRET sont corrects dans le .env<br />
          - Laravel est démarré (php artisan serve)<br />
          - Vous avez autorisé la caméra et le micro dans votre navigateur
        </p>
        <Link to={`/chat/${conversationUuid}`} style={{ color: '#38bdf8' }}>
          ← Retour au chat
        </Link>
      </div>
    );
  }

  return (
    <div className="layout" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#0f172a', padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <Link to={`/chat/${conversationUuid}`} style={{ color: '#38bdf8' }}>← Retour au chat</Link>
        <span style={{ marginLeft: 16, color: '#94a3b8' }}>
          {participantsCount} participant(s) connecté(s)
        </span>
      </div>

      {status === 'loading' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <h2>📞 Connexion en cours...</h2>
            <p style={{ color: '#94a3b8' }}>Initialisation de l'appel vidéo</p>
          </div>
        </div>
      )}

      {status === 'connected' && (
        <>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 24 }}>
            {/* Vidéo locale */}
            <div style={{ position: 'relative', background: '#1e293b', borderRadius: 12, overflow: 'hidden', minHeight: 300 }}>
              <video 
                ref={localVideoRef} 
                autoPlay 
                muted 
                playsInline 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              />
              <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'rgba(0, 0, 0, 0.6)', padding: '6px 12px', borderRadius: 6 }}>
                <strong style={{ color: '#f1f5f9' }}>Vous</strong>
              </div>
              {isCameraOff && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#334155' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 48, marginBottom: 8 }}>📷</div>
                    <div style={{ color: '#94a3b8' }}>Caméra désactivée</div>
                  </div>
                </div>
              )}
            </div>

            {/* Vidéo distante */}
            <div style={{ position: 'relative', background: '#1e293b', borderRadius: 12, overflow: 'hidden', minHeight: 300 }}>
              <video 
                ref={remoteVideoRef} 
                autoPlay 
                playsInline 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              />
              <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'rgba(0, 0, 0, 0.6)', padding: '6px 12px', borderRadius: 6 }}>
                <strong style={{ color: '#f1f5f9' }}>À distance</strong>
              </div>
              {participantsCount === 0 && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#334155' }}>
                  <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                    <div style={{ fontSize: 48, marginBottom: 8 }}>⏳</div>
                    <div>En attente d'autres participants...</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Contrôles */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button 
              type="button" 
              onClick={toggleMute} 
              style={{ 
                padding: '12px 24px', 
                borderRadius: 8, 
                background: isMuted ? '#dc2626' : '#334155',
                fontWeight: isMuted ? 'bold' : 'normal'
              }}
            >
              {isMuted ? '🔇 Micro coupé' : '🎤 Micro actif'}
            </button>
            <button 
              type="button" 
              onClick={toggleCamera} 
              style={{ 
                padding: '12px 24px', 
                borderRadius: 8, 
                background: isCameraOff ? '#dc2626' : '#334155',
                fontWeight: isCameraOff ? 'bold' : 'normal'
              }}
            >
              {isCameraOff ? '📷 Caméra off' : '📹 Caméra on'}
            </button>
            <button 
              type="button" 
              onClick={hangUp} 
              style={{ 
                padding: '12px 24px', 
                borderRadius: 8, 
                background: '#dc2626',
                fontWeight: 'bold'
              }}
            >
              📞 Raccrocher
            </button>
          </div>
        </>
      )}
    </div>
  );
}
