export const refId = (id) => (id ? `EPS-${String(id).slice(0, 8).toUpperCase()}` : '—');

export function dateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
}

export function dateOnly(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function duration(s) {
  if (s === null || s === undefined) return '—';
  const n = Math.max(0, Math.round(s));
  if (n < 60) return `${n}s`;
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const sec = n % 60;
  return h ? `${h}h ${m}m` : `${m}m ${String(sec).padStart(2, '0')}s`;
}

export const clock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export function ago(d) {
  const s = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

export const mobile = (m) => (m ? `+91 ${m.slice(0, 5)} ${m.slice(5)}` : '—');
export const initials = (name = '') => name.split(' ').filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase();

export const STATUS = {
  queued: { label: 'Waiting', tone: 'info' },
  in_progress: { label: 'On call', tone: 'live' },
  completed: { label: 'Completed', tone: 'good' },
  missed: { label: 'Missed', tone: 'warn' },
  cancelled: { label: 'Cancelled', tone: 'muted' },
  failed: { label: 'Failed', tone: 'bad' },
};

export const OUTCOMES = {
  interested: 'Interested',
  purchased: 'Purchased',
  follow_up: 'Needs follow-up',
  not_interested: 'Not interested',
  support: 'Support query',
  other: 'Other',
};

export const REQUESTS = { brochure: 'Brochure', store_assist: 'Store assist', callback: 'Callback' };

export const LANGUAGES = ['English', 'Hindi', 'Tamil', 'Telugu', 'Bengali', 'Marathi', 'Kannada', 'Malayalam', 'Gujarati', 'Punjabi'];

/** ISO yyyy-mm-dd for a date offset N days from today (local time). */
export function isoDay(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
