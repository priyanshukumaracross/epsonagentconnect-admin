// Backend address (Render), set as VITE_API_URL in Vercel. Empty in local dev: Vite proxies /api to the backend.
const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const SOCKET_URL = BASE || undefined;
// Customer website address (Vercel) - store QR codes point here
export const WEBSITE_URL = (import.meta.env.VITE_WEBSITE_URL || 'https://localhost:5173').replace(/\/$/, '');

const TOKEN_KEY = 'epson_console_token';
let onUnauthorized = () => {};

export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* ignore */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } },
};

export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export function qs(params = {}) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, v); });
  const s = p.toString();
  return s ? `?${s}` : '';
}

async function request(path, { method = 'GET', body, raw } = {}) {
  const token = tokenStore.get();
  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the server. Check your connection.');
  }
  if (res.status === 401 && !path.startsWith('/auth/login')) onUnauthorized();
  if (raw && res.ok) return res;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body }),
  patch: (p, body) => request(p, { method: 'PATCH', body }),
  async download(p, filename) {
    const res = await request(p, { raw: true });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
