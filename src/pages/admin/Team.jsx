import { useState } from 'react';
import { api } from '../../lib/api.js';
import { dateTime, LANGUAGES } from '../../lib/format.js';
import { useAuth, useRealtime } from '../../auth/AuthContext.jsx';
import { Empty, Modal, Rating, Spinner, useFetch, useToast } from '../../components/ui.jsx';
import { PlusIcon } from '../../components/Icons.jsx';

const PRESENCE_LABEL = { available: 'Available', away: 'Away', busy: 'On a call', offline: 'Offline' };

export default function Team() {
  const { user: me } = useAuth();
  const { presence, tick } = useRealtime();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(() => api.get('/admin/users'), [tick]);
  const [editing, setEditing] = useState(null); // user object or 'new'

  const live = new Map(presence.map((p) => [p.id, p.status]));

  const toggleActive = async (u) => {
    try {
      await api.patch(`/admin/users/${u.id}`, { isActive: !u.is_active });
      toast(`${u.name} ${u.is_active ? 'deactivated' : 'activated'}`, 'good');
      reload();
    } catch (e) { toast(e.message, 'bad'); }
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Team</h1><p className="muted">Product experts who take calls, and administrators. Experts log in to the same console URL.</p></div>
        <button className="btn btn-primary" onClick={() => setEditing('new')}><PlusIcon /> Add member</button>
      </div>
      {error && <div className="alert alert-error">{error.message}</div>}
      <div className="card table-card">
        {loading && !data ? <div className="center-pad"><Spinner dark /></div> : !data?.items.length ? <Empty title="No team members" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Name</th><th>Role</th><th>Languages</th><th>Live status</th><th className="num">Calls today</th><th className="num">Total calls</th><th>Rating</th><th>Last login</th><th>Account</th><th /></tr></thead>
              <tbody>
                {data.items.map((u) => {
                  const st = u.role === 'agent' ? live.get(u.id) || 'offline' : null;
                  return (
                    <tr key={u.id} className={u.is_active ? '' : 'inactive'}>
                      <td><b>{u.name}</b>{u.id === me.id && <span className="tiny"> (you)</span>}<div className="tiny">{u.email}</div></td>
                      <td><span className={`tag ${u.role === 'admin' ? 'tag-admin' : ''}`}>{u.role === 'admin' ? 'Admin' : 'Expert'}</span></td>
                      <td className="tiny">{u.languages.join(', ')}</td>
                      <td>{st ? <span className="presence-inline"><span className={`dot dot-${st}`} />{PRESENCE_LABEL[st]}</span> : <span className="tiny">—</span>}</td>
                      <td className="num">{u.role === 'agent' ? u.completed_today : '—'}</td>
                      <td className="num">{u.role === 'agent' ? u.completed_calls : '—'}</td>
                      <td><Rating value={u.avg_rating} /></td>
                      <td className="nowrap tiny">{dateTime(u.last_login_at)}</td>
                      <td>{u.is_active ? <span className="yes">Active</span> : <span className="no">Deactivated</span>}</td>
                      <td className="nowrap right">
                        <button className="btn btn-sm" onClick={() => setEditing(u)}>Edit</button>
                        {u.id !== me.id && <button className="btn btn-sm" onClick={() => toggleActive(u)}>{u.is_active ? 'Deactivate' : 'Activate'}</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editing && <UserForm user={editing === 'new' ? null : editing} isSelf={editing !== 'new' && editing.id === me.id} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </>
  );
}

function UserForm({ user, isSelf, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({
    name: user?.name || '', email: user?.email || '', password: '', role: user?.role || 'agent', languages: user?.languages || ['English', 'Hindi'],
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const toggleLang = (l) => setF((x) => ({ ...x, languages: x.languages.includes(l) ? x.languages.filter((y) => y !== l) : [...x.languages, l] }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (user) {
        const body = { name: f.name, languages: f.languages };
        if (!isSelf) body.role = f.role;
        if (f.password) body.password = f.password;
        await api.patch(`/admin/users/${user.id}`, body);
        toast('Member updated', 'good');
      } else {
        await api.post('/admin/users', f);
        toast(`${f.name} added. Share the login email and password with them.`, 'good');
      }
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={user ? `Edit ${user.name}` : 'Add team member'} onClose={onClose}
      footer={<><button className="btn" type="button" onClick={onClose}>Cancel</button><button className="btn btn-primary" form="user-form" disabled={busy}>{user ? 'Save changes' : 'Create account'}</button></>}>
      <form id="user-form" onSubmit={submit}>
        <label className="field"><span>Full name</span><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} /></label>
        <label className="field"><span>Email (login)</span><input className="input" type="email" value={f.email} disabled={!!user} onChange={(e) => setF({ ...f, email: e.target.value })} required /></label>
        <label className="field"><span>{user ? 'Reset password (leave blank to keep)' : 'Temporary password'}</span>
          <input className="input" type="text" autoComplete="new-password" minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required={!user} placeholder="At least 8 characters" />
        </label>
        <div className="field"><span>Role</span>
          <div className="seg">
            <button type="button" className={f.role === 'agent' ? 'on' : ''} disabled={isSelf} onClick={() => setF({ ...f, role: 'agent' })}>Product expert</button>
            <button type="button" className={f.role === 'admin' ? 'on' : ''} disabled={isSelf} onClick={() => setF({ ...f, role: 'admin' })}>Administrator</button>
          </div>
        </div>
        <div className="field"><span>Languages spoken</span>
          <div className="chips">
            {LANGUAGES.map((l) => <button type="button" key={l} className={`chip ${f.languages.includes(l) ? 'on' : ''}`} onClick={() => toggleLang(l)}>{l}</button>)}
          </div>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
      </form>
    </Modal>
  );
}
