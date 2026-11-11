import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../lib/api.js';
import { useToast } from '../components/ui.jsx';

export default function Account() {
  const { user } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (f.newPassword !== f.confirm) return setError('New passwords do not match');
    setBusy(true);
    try {
      await api.post('/auth/change-password', { currentPassword: f.currentPassword, newPassword: f.newPassword });
      setF({ currentPassword: '', newPassword: '', confirm: '' });
      toast('Password updated', 'good');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head"><div><h1>My account</h1><p className="muted">{user.email} · {user.role === 'admin' ? 'Administrator' : 'Product expert'}</p></div></div>
      <div className="grid-2">
        <div className="card">
          <h3>Profile</h3>
          <dl className="dl">
            <dt>Name</dt><dd>{user.name}</dd>
            <dt>Email</dt><dd>{user.email}</dd>
            <dt>Role</dt><dd style={{ textTransform: 'capitalize' }}>{user.role}</dd>
            <dt>Languages</dt><dd>{user.languages?.join(', ')}</dd>
          </dl>
          <p className="tiny" style={{ marginTop: 12 }}>Ask an administrator to change your name or languages.</p>
        </div>
        <form className="card" onSubmit={submit}>
          <h3>Change password</h3>
          <label className="field"><span>Current password</span>
            <input className="input" type="password" autoComplete="current-password" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} required />
          </label>
          <label className="field"><span>New password</span>
            <input className="input" type="password" autoComplete="new-password" minLength={8} value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} required />
          </label>
          <label className="field"><span>Confirm new password</span>
            <input className="input" type="password" autoComplete="new-password" minLength={8} value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} required />
          </label>
          {error && <div className="alert alert-error">{error}</div>}
          <button className="btn btn-primary" disabled={busy}>Update password</button>
        </form>
      </div>
    </>
  );
}
