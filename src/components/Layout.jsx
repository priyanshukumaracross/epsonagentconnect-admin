import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth, useRealtime } from '../auth/AuthContext.jsx';
import { initials } from '../lib/format.js';
import {
  CallsIcon, CloseIcon, DashboardIcon, HeadsetIcon, HistoryIcon, LeadsIcon, LogoutIcon, MenuIcon, StoreIcon, TeamIcon, UserIcon,
} from './Icons.jsx';
import epsonLogo from '../assets/epson-logo.webp';

const NAV = {
  admin: [
    { to: '/admin', label: 'Dashboard', icon: DashboardIcon, end: true },
    { to: '/admin/calls', label: 'Calls', icon: CallsIcon },
    { to: '/admin/leads', label: 'Leads', icon: LeadsIcon },
    { to: '/admin/team', label: 'Team', icon: TeamIcon },
    { to: '/admin/stores', label: 'Stores & QR', icon: StoreIcon },
  ],
  agent: [
    { to: '/agent', label: 'Live console', icon: HeadsetIcon, end: true },
    { to: '/agent/history', label: 'My calls', icon: HistoryIcon },
  ],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const { connected, queue, status, setStatus } = useRealtime();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  const isAgent = user.role === 'agent';

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="side-brand">
          <img className="wordmark" src={epsonLogo} alt="Epson" />
          <span className="side-sub">{isAgent ? 'Expert Console' : 'Admin'}</span>
          <button className="icon-btn mobile-only" onClick={() => setOpen(false)} aria-label="Close menu"><CloseIcon /></button>
        </div>
        <nav>
          {NAV[user.role].map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon /> <span>{label}</span>
              {isAgent && to === '/agent' && queue.length > 0 && <span className="nav-count">{queue.length}</span>}
            </NavLink>
          ))}
          <NavLink to={`/${user.role}/account`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <UserIcon /> <span>My account</span>
          </NavLink>
        </nav>
        <div className="side-foot">
          <div className="me">
            <div className="avatar">{initials(user.name)}</div>
            <div className="me-text"><b>{user.name}</b><span>{user.email}</span></div>
          </div>
          <button className="nav-item" onClick={logout}><LogoutIcon /> <span>Log out</span></button>
        </div>
      </aside>
      {open && <div className="side-scrim" onClick={() => setOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="icon-btn mobile-only" onClick={() => setOpen(true)} aria-label="Open menu"><MenuIcon /></button>
          <div className="topbar-spacer" />
          <span className={`conn ${connected ? 'on' : 'off'}`} title={connected ? 'Live updates connected' : 'Reconnecting…'}>
            <i /> {connected ? 'Live' : 'Reconnecting…'}
          </span>
          {isAgent && (
            <div className="status-switch" role="group" aria-label="Your availability">
              {status === 'busy' ? (
                <span className="status-pill busy"><i />On a call</span>
              ) : (
                <>
                  <button className={status === 'available' ? 'on available' : ''} onClick={() => setStatus('available')} disabled={!connected}><i />Available</button>
                  <button className={status === 'away' ? 'on away' : ''} onClick={() => setStatus('away')} disabled={!connected}><i />Away</button>
                </>
              )}
            </div>
          )}
        </header>
        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
