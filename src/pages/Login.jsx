import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { Spinner } from '../components/ui.jsx';
import epsonLogo from '../assets/epson-logo.webp';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-art">
        <img className="wordmark light" src={epsonLogo} alt="Epson" />
        <div>
          <h1>Expert Connect</h1>
          <p>Help in-store customers choose the right Epson product — over live video and voice calls.</p>
        </div>
        <span className="tagline">Exceed Your Vision</span>
      </div>
      <div className="login-form-wrap">
        <form className="login-card" onSubmit={submit}>
          <img className="wordmark mobile-only" src={epsonLogo} alt="Epson" />
          <h2>Sign in</h2>
          <p className="muted">Admins and product experts use the same login.</p>
          <label className="field">
            <span>Email</span>
            <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </label>
          <label className="field">
            <span>Password</span>
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <div className="alert alert-error">{error}</div>}
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? <Spinner /> : 'Sign in'}</button>
        </form>
      </div>
    </div>
  );
}
