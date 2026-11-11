import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, qs } from '../../lib/api.js';
import { dateTime, mobile } from '../../lib/format.js';
import { useRealtime } from '../../auth/AuthContext.jsx';
import { Empty, Pagination, Spinner, StatusBadge, useFetch, useToast } from '../../components/ui.jsx';
import { DownloadIcon, SearchIcon } from '../../components/Icons.jsx';
import LeadDrawer from '../../components/LeadDrawer.jsx';

const FILTER_KEYS = ['search', 'state', 'connected', 'storeId', 'from', 'to'];

export default function Leads() {
  const { tick } = useRealtime();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const [openLead, setOpenLead] = useState(null);
  const [search, setSearch] = useState(sp.get('search') || '');

  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, sp.get(k) || '']));
  const page = Number(sp.get('page') || 1);
  const key = sp.toString();

  const { data, loading, error } = useFetch(() => api.get(`/admin/leads${qs({ ...filters, page, limit: 25 })}`), [key, tick]);
  const states = useFetch(() => api.get('/admin/leads/states'), [tick]);
  const stores = useFetch(() => api.get('/admin/stores'), []);

  const set = (patch) => {
    const next = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in patch)) next.delete('page');
    setSp(next, { replace: true });
  };
  const hasFilters = FILTER_KEYS.some((k) => filters[k]);
  const exportCsv = () => api.download(`/admin/export/leads.csv${qs(filters)}`, `epson-leads-${new Date().toISOString().slice(0, 10)}.csv`).catch((e) => toast(e.message, 'bad'));

  return (
    <>
      <div className="page-head">
        <div><h1>Leads</h1><p className="muted">Customers who filled the details form after scanning a store QR code.</p></div>
        <button className="btn" onClick={exportCsv}><DownloadIcon /> Export CSV</button>
      </div>

      <div className="card filters">
        <form className="search" onSubmit={(e) => { e.preventDefault(); set({ search: search.trim() }); }}>
          <SearchIcon />
          <input className="input" placeholder="Search name, mobile or city" value={search} onChange={(e) => setSearch(e.target.value)} onBlur={() => set({ search: search.trim() })} />
        </form>
        <select className="input" value={filters.connected} onChange={(e) => set({ connected: e.target.value })} aria-label="Connected">
          <option value="">Connected: any</option><option value="yes">Talked to expert</option><option value="no">Not connected</option>
        </select>
        <select className="input" value={filters.state} onChange={(e) => set({ state: e.target.value })} aria-label="State">
          <option value="">All states</option>
          {states.data?.items.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input" value={filters.storeId} onChange={(e) => set({ storeId: e.target.value })} aria-label="Store">
          <option value="">All stores</option>
          {stores.data?.items.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <label className="date"><span>From</span><input className="input" type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} /></label>
        <label className="date"><span>To</span><input className="input" type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} /></label>
        {hasFilters && <button className="link" onClick={() => { setSearch(''); setSp({}, { replace: true }); }}>Clear filters</button>}
      </div>

      {error && <div className="alert alert-error">{error.message}</div>}
      <div className="card table-card">
        {loading && !data ? <div className="center-pad"><Spinner dark /></div> : data?.items.length === 0 ? (
          <Empty title="No leads found">{hasFilters ? 'Try changing the filters.' : 'Leads appear here when customers submit the form.'}</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Submitted</th><th>Name</th><th>Mobile</th><th>City / State</th><th>Store</th><th>Product · Interest</th><th className="num">Calls</th><th>Last call</th><th>Talked to expert?</th></tr>
              </thead>
              <tbody>
                {data?.items.map((l) => (
                  <tr key={l.id} className="clickable" onClick={() => setOpenLead(l.id)}>
                    <td className="nowrap">{dateTime(l.created_at)}</td>
                    <td><b>{l.name}</b></td>
                    <td className="nowrap">{mobile(l.mobile)}</td>
                    <td>{l.city}<div className="tiny">{l.state}</div></td>
                    <td>{l.store_name || <span className="tiny">—</span>}</td>
                    <td>{l.product || '—'}<div className="tiny">{l.interests?.join(', ')}</div></td>
                    <td className="num">{l.call_count}</td>
                    <td>{l.last_call_status ? <><StatusBadge status={l.last_call_status} /><div className="tiny">{l.last_agent || ''}</div></> : <span className="tiny">No call started</span>}</td>
                    <td>{l.connected ? <span className="yes">✓ Yes</span> : <span className="no">✕ No</span>}</td>
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
