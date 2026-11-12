import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { api, setUnauthorizedHandler, SOCKET_URL, tokenStore } from '../lib/api.js';

/* ======================= Auth ======================= */
const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => tokenStore.get());
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!token);

  const logout = useCallback(() => {
    tokenStore.clear();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => { setUnauthorizedHandler(logout); }, [logout]);

  useEffect(() => {
    if (!token || user) { setLoading(false); return; }
    api.get('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [token, user, logout]);

  const login = useCallback(async (email, password) => {
    const d = await api.post('/auth/login', { email, password });
    tokenStore.set(d.token);
    setUser(d.user);
    setToken(d.token);
    return d.user;
  }, []);

  const value = useMemo(() => ({ token, user, loading, login, logout }), [token, user, loading, login, logout]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

/* ======================= Realtime (Socket.IO) ======================= */
const RealtimeCtx = createContext(null);
export const useRealtime = () => useContext(RealtimeCtx);

export function RealtimeProvider({ children }) {
  const { token, logout } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [queue, setQueue] = useState([]);        // agents: waiting customers
  const [status, setStatusState] = useState('available'); // agents: own availability
  const [presence, setPresence] = useState([]);  // admins: online agents
  const [tick, setTick] = useState(0);           // admins: bumps when call data changes

  useEffect(() => {
    if (!token) return undefined;
    // Default transports: HTTP long-polling, upgraded to WebSocket when available
    const s = io(SOCKET_URL, { auth: { token } });
    let t;
    let retry;
    s.on('connect', () => setConnected(true));
    s.on('disconnect', (reason) => {
      setConnected(false);
      if (reason === 'io server disconnect') logout(); // account deactivated / role changed
    });
    s.on('connect_error', (err) => {
      if (err.message === 'UNAUTHORIZED') logout();
      // server-side rejections are not retried automatically by socket.io - try again shortly
      else if (err.message === 'SERVER_ERROR') { clearTimeout(retry); retry = setTimeout(() => s.connect(), 3000); }
    });
    s.on('queue:update', setQueue);
    s.on('agent:status', setStatusState);
    s.on('agents:presence', setPresence);
    s.on('calls:changed', () => { clearTimeout(t); t = setTimeout(() => setTick((x) => x + 1), 400); });
    setSocket(s);
    return () => { clearTimeout(t); clearTimeout(retry); s.disconnect(); setSocket(null); };
  }, [token, logout]);

  const setStatus = useCallback((st) => socket?.emit('agent:setStatus', st), [socket]);

  const value = useMemo(
    () => ({ socket, connected, queue, status, setStatus, setStatusLocal: setStatusState, presence, tick }),
    [socket, connected, queue, status, setStatus, presence, tick],
  );
  return <RealtimeCtx.Provider value={value}>{children}</RealtimeCtx.Provider>;
}
