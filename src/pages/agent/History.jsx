import { useState } from 'react';
import { api, qs } from '../../lib/api.js';
import { dateTime, duration, mobile, refId } from '../../lib/format.js';
import { Empty, Modal, OutcomeTag, Pagination, Rating, RequestTags, Spinner, StatusBadge, useFetch, useToast } from '../../components/ui.jsx';
import { PhoneIcon, SearchIcon, VideoIcon } from '../../components/Icons.jsx';
import NotesForm from './NotesForm.jsx';

export default function History() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState(null);
  const { data, loading, error, reload } = useFetch(
    () => api.get(`/agent/calls${qs({ page, search: q, pending: pending ? 'yes' : '' })}`),
    [page, q, pending],
  );

  return (
    <>
      <div className="page-head"><div><h1>My calls</h1><p className="muted">Calls you have handled. Add an outcome so the team can follow up.</p></div></div>
      <div className="card filters">
        <form className="search" onSubmit={(e) => { e.preventDefault(); setPage(1); setQ(search.trim()); }}>
          <SearchIcon />
          <input className="input" placeholder="Search name, mobile or city" value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>
        <label className="check"><input type="checkbox" checked={pending} onChange={(e) => { setPage(1); setPending(e.target.checked); }} /> Only calls without notes</label>
      </div>
      {error && <div className="alert alert-error">{error.message}</div>}
      <div className="card table-card">
        {loading && !data ? <div className="center-pad"><Spinner dark /></div> : !data?.items.length ? <Empty title="No calls yet">Calls you accept from the live console show up here.</Empty> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>When</th><th>Customer</th><th>Location</th><th>Type</th><th>Status</th><th className="num">Talk time</th><th>Rating</th><th>Outcome</th><th>Notes</th><th /></tr></thead>
              <tbody>
                {data.items.map((c) => (
                  <tr key={c.id}>
                    <td className="nowrap">{dateTime(c.requested_at)}<div className="tiny mono">{refId(c.id)}</div></td>
                    <td><b>{c.customer_name}</b><div className="tiny">{mobile(c.mobile)}</div></td>
                    <td>{c.city}<div className="tiny">{c.store_name || c.state}</div></td>
                    <td><span className="mode-ic">{c.mode === 'video' ? <VideoIcon width="15" /> : <PhoneIcon width="15" />}{c.language}</span></td>
                    <td><StatusBadge status={c.status} /><RequestTags items={c.customer_requests} /></td>
                    <td className="num">{duration(c.duration_seconds)}</td>
                    <td><Rating value={c.rating} /></td>
                    <td><OutcomeTag outcome={c.outcome} /></td>
                    <td className="notes-cell">{c.agent_notes || <span className="tiny">—</span>}</td>
                    <td className="right"><button className={`btn btn-sm ${c.outcome ? '' : 'btn-primary'}`} onClick={() => setEditing(c)}>{c.outcome ? 'Edit' : 'Add notes'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pagination page={data.page} limit={data.limit} total={data.total} onPage={setPage} />}
      </div>
      {editing && (
        <Modal title={`Notes · ${editing.customer_name}`} onClose={() => setEditing(null)}>
          <NotesForm compact callId={editing.id} initial={editing} onSaved={() => { setEditing(null); reload(); toast('Notes saved', 'good'); }} />
        </Modal>
      )}
    </>
  );
}
