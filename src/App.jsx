import { Navigate, Route, Routes } from 'react-router-dom';
import { RealtimeProvider, useAuth } from './auth/AuthContext.jsx';
import { Spinner } from './components/ui.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Account from './pages/Account.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import Calls from './pages/admin/Calls.jsx';
import Leads from './pages/admin/Leads.jsx';
import Team from './pages/admin/Team.jsx';
import Stores from './pages/admin/Stores.jsx';
import Console from './pages/agent/Console.jsx';
import History from './pages/agent/History.jsx';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <div className="center-pad full"><Spinner dark /></div>;
  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  const home = user.role === 'admin' ? '/admin' : '/agent';
  return (
    <RealtimeProvider>
      <Routes>
        {user.role === 'admin' && (
          <Route path="/admin" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="calls" element={<Calls />} />
            <Route path="leads" element={<Leads />} />
            <Route path="team" element={<Team />} />
            <Route path="stores" element={<Stores />} />
            <Route path="account" element={<Account />} />
          </Route>
        )}
        {user.role === 'agent' && (
          <Route path="/agent" element={<Layout />}>
            <Route index element={<Console />} />
            <Route path="history" element={<History />} />
            <Route path="account" element={<Account />} />
          </Route>
        )}
        <Route path="*" element={<Navigate to={home} replace />} />
      </Routes>
    </RealtimeProvider>
  );
}
