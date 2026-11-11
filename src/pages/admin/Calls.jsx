import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, qs } from '../../lib/api.js';
import { dateTime, duration, mobile, refId, STATUS } from '../../lib/format.js';
import { useRealtime } from '../../auth/AuthContext.jsx';
import { DoneBadge, Empty, OutcomeTag, Pagination, Rating, RequestTags, Spinner, StatusBadge, useFetch, useToast } from '../../components/ui.jsx';
import { DownloadIcon, PhoneIcon, SearchIcon, VideoIcon } from '../../components/Icons.jsx';
import LeadDrawer from '../../components/LeadDrawer.jsx';

const FILTER_KEYS = ['search', 'status', 'connected', 'mode', 'agentId', 'storeId', 'from', 'to', 'callback'];

export default function Calls() {
  const { tick } = useRealtime();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const [openLead, setOpenLead] = useState(null);
  const [search, setSearch] = useState(sp.get('search') || '');

  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, sp.get(k) || '']));
  const page = Number(sp.get('page') || 1);
  const key = sp.toString();

  const { data, loading, error } = useFetch(() => api.get(`/admin/calls${qs({ ...filters, page, limit: 25 })}`), [key, tick]);
  const agents = useFetch(() => api.get('/admin/users'), []);
  const stores = useFetch(() => api.get('/admin/stores'), []);

  const set = (patch) => {
    const next = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in patch)) next.delete('page');
    setSp(next, { replace: true });
  };

  const exportCsv = () => api.download(`/admin/export/calls.csv${qs(filters)}`, `epson-calls-${new Date().toISOString().slice(0, 10)}.csv`).catch((e) => toast(e.message, 'bad'));
  const hasFilters = FILTER_KEYS.some((k) => filters[k]);

  return (
    <>
      <div className="page-head">
        <div><h1>Calls</h1><p className="muted">Every call request, who picked it up and whether the call actually happened.</p></div>
        <button className="btn" onClick={exportCsv}><DownloadIcon /> Export CSV</button>
      </div>

      <div className="card filters">
        <form className="search" onSubmit={(e) => { e.preventDefault(); set({ search: search.trim() }); }}>
          <SearchIcon />
          <input className="input" placeholder="Search name, mobile, city or EPS- reference" value={search} onChange={(e) => setSearch(e.target.value)} onBlur={() => set({ search: search.trim() })} />
        </form>
        <select className="input" value={filters.connected} onChange={(e) => set({ connected: e.target.value })} aria-label="Call done">
          <option value="">Call done: any</option><option value="yes">Call done: Yes</option><option value="no">Call done: No</option>
        </select>
        <select className="input" value={filters.status} onChange={(e) => set({ status: e.target.value })} aria-label="Status">
          <option value="">All statuses</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="input" value={filters.mode} onChange={(e) => set({ mode: e.target.value })} aria-label="Mode">
          <option value="">Video &amp; voice</option><option value="video">Video</option><option value="voice">Voice</option>
        </select>
        <select className="input" value={filters.agentId} onChange={(e) => set({ agentId: e.target.value })} aria-label="Expert">
          <option value="">All experts</option>
          {agents.data?.items.filter((u) => u.role === 'agent').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select className="input" value={filters.storeId} onChange={(e) => set({ storeId: e.target.value })} aria-label="Store">
          <option value="">All stores</option>
          {stores.data?.items.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <label className="date"><span>From</span><input className="input" type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} /></label>
        <label className="date"><span>To</span><input className="input" type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} /></label>
        <label className="check"><input type="checkbox" checked={filters.callback === 'yes'} onChange={(e) => set({ callback: e.target.checked ? 'yes' : '' })} /> Callback requested</label>
        {hasFilters && <button className="link" onClick={() => { setSearch(''); setSp({}, { replace: true }); }}>Clear filters</button>}
      </div>

      {error && <div className="alert alert-error">{error.message}</div>}
      <div className="card table-card">
        {loading && !data ? <div className="center-pad"><Spinner dark /></div> : data?.items.length === 0 ? (
          <Empty title="No calls found">{hasFilters ? 'Try changing the filters.' : 'Calls appear here once customers start requesting experts.'}</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Reference</th><th>Requested</th><th>Customer</th><th>Location / Store</th><th>Type</th><th>Expert</th>
                  <th>Status</th><th>Call done?</th><th className="num">Wait</th><th className="num">Talk time</th><th>Rating</th><th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => setOpenLead(c.lead_id)}>
                    <td className="mono">{refId(c.id)}</td>
                    <td className="nowrap">{dateTime(c.requested_at)}</td>
                    <td><b>{c.customer_name}</b><div className="tiny">{mobile(c.mobile)}</div></td>
                    <td>{c.city}, {c.state}<div className="tiny">{c.store_name || 'No store'}</div></td>
                    <td className="nowrap"><span className="mode-ic">{c.mode === 'video' ? <VideoIcon width="15" /> : <PhoneIcon width="15" />}{c.mode === 'video' ? 'Video' : 'Voice'}</span><div className="tiny">{c.language}</div></td>
                    <td>{c.agent_name || <span className="tiny">—</span>}</td>
                    <td><StatusBadge status={c.status} /><RequestTags items={c.customer_requests} /></td>
                    <td><DoneBadge status={c.status} /></td>
                    <td className="num">{duration(c.wait_seconds)}</td>
                    <td className="num">{duration(c.duration_seconds)}</td>
                    <td><Rating value={c.rating} /></td>
                    <td><OutcomeTag outcome={c.outcome} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pagination page={data.page} limit={data.limit} total={data.total} onPage={(p) => set({ page: String(p) })} />}
      </div>
      {openLead && <LeadDrawer leadId={openLead} onClose={() => setOpenLead(null)} />}
    </>
  );
}
