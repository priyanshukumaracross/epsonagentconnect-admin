import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { STATUS, OUTCOMES, REQUESTS } from '../lib/format.js';
import { CloseIcon } from './Icons.jsx';

export function StatusBadge({ status }) {
  const s = STATUS[status] || { label: status, tone: 'muted' };
  return <span className={`badge badge-${s.tone}`}><i />{s.label}</span>;
}

export function DoneBadge({ status }) {
  if (status === 'queued' || status === 'in_progress') return <span className="tiny">—</span>;
  return status === 'completed' ? <span className="yes">✓ Yes</span> : <span className="no">✕ No</span>;
}

export function OutcomeTag({ outcome }) {
  if (!outcome) return <span className="tiny">—</span>;
  return <span className={`tag tag-${outcome}`}>{OUTCOMES[outcome] || outcome}</span>;
}

export function RequestTags({ items }) {
  if (!items?.length) return null;
  return <span className="req-tags">{items.map((r) => <span key={r} className={`tag ${r === 'callback' ? 'tag-follow_up' : ''}`}>{REQUESTS[r] || r}</span>)}</span>;
}

export function Rating({ value }) {
  if (!value) return <span className="tiny">—</span>;
  return <span className="rating">★ {Number(value).toFixed(value % 1 ? 1 : 0)}</span>;
}

export function Spinner({ dark }) {
  return <span className={`spinner ${dark ? 'dark' : ''}`} aria-label="Loading" />;
}

export function Empty({ title = 'Nothing here yet', children }) {
  return (
    <div className="empty">
      <b>{title}</b>
      {children && <p>{children}</p>}
    </div>
  );
}

export function Pagination({ page, limit, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (total <= limit) return <div className="pagination"><span className="tiny">{total} record{total === 1 ? '' : 's'}</span></div>;
  return (
    <div className="pagination">
      <span className="tiny">{(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</span>
      <div>
        <button className="btn btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <span className="tiny" style={{ margin: '0 10px' }}>Page {page} / {pages}</span>
        <button className="btn btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay drawer-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}

/* ---------- Toasts ---------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const id = useRef(0);
  const toast = useCallback((message, tone = 'default') => {
    const key = ++id.current;
    setItems((xs) => [...xs, { key, message, tone }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.key !== key)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => <div key={t.key} className={`toast toast-${t.tone}`}>{t.message}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}

/** Fetch helper: re-runs when deps change. */
export function useFetch(fn, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const reload = useCallback(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn().then(
      (data) => alive && setState({ data, loading: false, error: null }),
      (error) => alive && setState((s) => ({ ...s, loading: false, error })),
    );
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(reload, [reload]);
  return { ...state, reload };
}
