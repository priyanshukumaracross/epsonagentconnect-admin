import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, qs } from '../../lib/api.js';
import { ago, duration, isoDay, mobile } from '../../lib/format.js';
import { useRealtime } from '../../auth/AuthContext.jsx';
import { Empty, Rating, Spinner, StatusBadge, useFetch } from '../../components/ui.jsx';

const RANGES = [
  { key: 'today', label: 'Today', from: () => isoDay(0) },
  { key: '7d', label: '7 days', from: () => isoDay(-6) },
  { key: '30d', label: '30 days', from: () => isoDay(-29) },
  { key: 'all', label: 'All time', from: () => '' },
];

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

export default function Dashboard() {
  const { tick, presence } = useRealtime();
  const [range, setRange] = useState('7d');
  const r = RANGES.find((x) => x.key === range);
  const params = { from: r.from(), to: range === 'all' ? '' : isoDay(0) };

  const stats = useFetch(() => api.get(`/admin/stats${qs(params)}`), [range, tick]);
  const live = useFetch(() => api.get('/admin/calls?status=queued,in_progress&limit=20'), [tick]);

  const t = stats.data?.totals;
  const notConnected = t ? t.missed + t.cancelled + t.failed : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">Customer requests from store QR codes and how many were connected to an expert.</p>
        </div>
        <div className="seg" role="tablist">
          {RANGES.map((x) => (
            <button key={x.key} role="tab" aria-selected={range === x.key} className={range === x.key ? 'on' : ''} onClick={() => setRange(x.key)}>{x.label}</button>
          ))}
        </div>
      </div>

      {stats.error && <div className="alert alert-error">{stats.error.message}</div>}
      {!t ? <div className="center-pad"><Spinner dark /></div> : (
        <>
          <div className="kpis">
            <Kpi label="Leads captured" value={t.leads} sub={`${pct(t.connected_leads, t.leads)}% talked to an expert`} />
            <Kpi label="Call requests" value={t.calls} sub={`${t.video} video · ${t.voice} voice`} />
            <Kpi label="Calls completed" value={t.completed} sub={`${pct(t.completed, t.calls)}% connection rate`} tone="good" />
            <Kpi label="Not connected" value={notConnected} sub={`${t.missed} missed · ${t.cancelled} cancelled`} tone="warn" link={`/admin/calls?connected=no`} />
            <Kpi label="Avg. talk time" value={duration(t.avg_duration)} sub={`${t.purchased} marked purchased`} />
            <Kpi label="Avg. rating" value={t.avg_rating ? `★ ${t.avg_rating}` : '—'} sub={t.callbacks ? `${t.callbacks} callback request${t.callbacks > 1 ? 's' : ''} pending` : 'No pending callbacks'} link={t.callbacks ? '/admin/calls?callback=yes' : undefined} />
          </div>

          <div className="grid-dash">
            <div className="card">
              <DailyChart rows={stats.data.daily} />
            </div>

            <div className="card">
              <div className="card-head"><h3>Live now</h3><span className="tiny">{presence.length} expert{presence.length === 1 ? '' : 's'} online</span></div>
              {presence.length === 0 ? <Empty title="No experts online">Customers will wait in queue and be marked missed after the timeout.</Empty> : (
                <ul className="presence">
                  {presence.map((p) => (
                    <li key={p.id}>
                      <span className={`dot dot-${p.status}`} />
                      <b>{p.name}</b>
                      <span className="tiny">{p.status === 'busy' ? 'On a call' : p.status === 'away' ? 'Away' : 'Available'} · {ago(p.since)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <h4 className="section-title">Active calls ({live.data?.total ?? 0})</h4>
              {live.data?.items?.length ? (
                <ul className="live-calls">
                  {live.data.items.map((c) => (
                    <li key={c.id}>
                      <div><b>{c.customer_name}</b><span className="tiny">{mobile(c.mobile)} · {c.city}</span></div>
                      <div className="right"><StatusBadge status={c.status} /><span className="tiny">{c.agent_name || `waiting ${ago(c.requested_at)}`}</span></div>
                    </li>
                  ))}
                </ul>
              ) : <p className="muted">No customers waiting or on a call.</p>}
            </div>
          </div>

          <div className="grid-3">
            <div className="card">
              <div className="card-head"><h3>Expert performance</h3><Link to="/admin/team" className="link tiny">Manage team</Link></div>
              <table className="table compact">
                <thead><tr><th>Expert</th><th className="num">Calls</th><th className="num">Avg time</th><th className="num">Rating</th><th className="num">Sold</th></tr></thead>
                <tbody>
                  {stats.data.agents.map((a) => (
                    <tr key={a.id}><td>{a.name}</td><td className="num">{a.completed}</td><td className="num">{duration(a.avg_duration)}</td><td className="num"><Rating value={a.avg_rating} /></td><td className="num">{a.purchased}</td></tr>
                  ))}
                  {!stats.data.agents.length && <tr><td colSpan={5} className="muted">No experts yet</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="card">
              <h3>Top states</h3>
              <BarList rows={stats.data.topStates.map((s) => ({ label: s.state, value: s.leads }))} />
            </div>
            <div className="card">
              <h3>Top stores</h3>
              <BarList rows={stats.data.topStores.filter((s) => s.leads).map((s) => ({ label: s.name, value: s.leads }))} />
            </div>
          </div>
        </>
      )}
    </>
  );
}

function Kpi({ label, value, sub, tone, link }) {
  const body = (
    <>
      <span className="kpi-label">{tone && <i className={`kpi-dot ${tone}`} />}{label}</span>
      <b className="kpi-value">{value}</b>
      <span className="kpi-sub">{sub}</span>
    </>
  );
  return link ? <Link to={link} className="kpi card link-card">{body}</Link> : <div className="kpi card">{body}</div>;
}

function BarList({ rows }) {
  if (!rows.length) return <p className="muted">No data in this period.</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="barlist">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="barlist-row"><span>{r.label}</span><b>{r.value}</b></div>
          <div className="barlist-track"><i style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

/** 14-day stacked bar: completed vs not connected. */
function DailyChart({ rows }) {
  const [hover, setHover] = useState(null);
  const [asTable, setAsTable] = useState(false);
  const max = useMemo(() => Math.max(1, ...rows.map((r) => r.completed + r.not_connected)), [rows]);
  const ticks = useMemo(() => {
    const step = Math.max(1, Math.ceil(max / 4));
    return Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
  }, [max]);
  const top = ticks[ticks.length - 1] < max ? max : ticks[ticks.length - 1];
  const day = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

  return (
    <>
      <div className="card-head">
        <div>
          <h3>Calls per day</h3>
          <span className="tiny">Last 14 days</span>
        </div>
        <div className="legend">
          <span><i className="sw sw-a" />Completed</span>
          <span><i className="sw sw-b" />Not connected</span>
          <button className="link tiny" onClick={() => setAsTable((v) => !v)}>{asTable ? 'View chart' : 'View table'}</button>
        </div>
      </div>
      {asTable ? (
        <table className="table compact">
          <thead><tr><th>Day</th><th className="num">Completed</th><th className="num">Not connected</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.day}><td>{day(r.day)}</td><td className="num">{r.completed}</td><td className="num">{r.not_connected}</td></tr>)}</tbody>
        </table>
      ) : (
        <div className="chart">
          <div className="chart-y">{[...ticks].reverse().map((v) => <span key={v} style={{ bottom: `${(v / top) * 100}%` }}>{v}</span>)}</div>
          <div className="chart-plot">
            {ticks.map((v) => <div key={v} className="gridline" style={{ bottom: `${(v / top) * 100}%` }} />)}
            {rows.map((r, i) => {
              const total = r.completed + r.not_connected;
              return (
                <div key={r.day} className={`col ${hover === i ? 'hover' : ''}`} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  <div className="stack" style={{ height: `${(total / top) * 100}%` }}>
                    {r.not_connected > 0 && <div className="seg-b" style={{ flexGrow: r.not_connected }} />}
                    {r.completed > 0 && <div className="seg-a" style={{ flexGrow: r.completed }} />}
                  </div>
                  <span className="xlabel">{i % 2 === rows.length % 2 ? '' : day(r.day)}</span>
                  {hover === i && (
                    <div className={`tip ${i > rows.length - 4 ? 'left' : ''}`}>
                      <b>{day(r.day)}</b>
                      <div><i className="sw sw-a" />Completed <b>{r.completed}</b></div>
                      <div><i className="sw sw-b" />Not connected <b>{r.not_connected}</b></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
