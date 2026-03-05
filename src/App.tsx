import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Conversations from './pages/Conversations';
import Chat from './pages/Chat';
import CallRoom from './pages/CallRoom';

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="layout">Chargement…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Protected>
            <Conversations />
          </Protected>
          
        }
      />
      <Route
        path="/chat/:conversationUuid"
        element={
          <Protected>
            <Chat />
          </Protected>
        }
      />
      <Route
        path="/call/:conversationUuid"
        element={
          <Protected>
            <CallRoom />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
