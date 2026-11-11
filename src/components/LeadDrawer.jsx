import { api } from '../lib/api.js';
import { dateTime, duration, mobile, refId } from '../lib/format.js';
import { Drawer, OutcomeTag, Rating, RequestTags, Spinner, StatusBadge, useFetch } from './ui.jsx';

/** Customer profile + full call timeline. */
export default function LeadDrawer({ leadId, onClose }) {
  const { data, loading, error } = useFetch(() => api.get(`/admin/leads/${leadId}`), [leadId]);
  const lead = data?.lead;

  return (
    <Drawer title="Customer details" onClose={onClose}>
      {loading && !data && <div className="center-pad"><Spinner dark /></div>}
      {error && <div className="alert alert-error">{error.message}</div>}
      {lead && (
        <>
          <div className="lead-head">
            <div className="avatar lg">{lead.name[0]}</div>
            <div>
              <h2>{lead.name}</h2>
              <a href={`tel:+91${lead.mobile}`} className="link">{mobile(lead.mobile)}</a>
            </div>
            <span className={`pill ${lead.connected ? 'pill-good' : 'pill-warn'}`}>{lead.connected ? 'Connected with expert' : 'Not connected yet'}</span>
          </div>
          <dl className="dl">
            <dt>Location</dt><dd>{lead.city}, {lead.state}</dd>
            <dt>Store</dt><dd>{lead.store_name ? `${lead.store_name} (${lead.store_code})` : '—'}</dd>
            <dt>Product</dt><dd>{lead.product || '—'}</dd>
            <dt>Looking for</dt><dd>{lead.interests?.length ? lead.interests.join(', ') : '—'}</dd>
            <dt>Submitted</dt><dd>{dateTime(lead.created_at)}</dd>
            <dt>Consent</dt><dd>{lead.consent ? 'Yes' : 'No'}</dd>
          </dl>

          <h4 className="section-title">Call history ({data.calls.length})</h4>
          {data.calls.length === 0 && <p className="muted">The customer filled the form but did not start a call.</p>}
          <div className="timeline">
            {data.calls.map((c) => (
              <div key={c.id} className="tl-item">
                <div className="tl-top">
                  <StatusBadge status={c.status} />
                  <span className="tiny">{refId(c.id)} · {dateTime(c.requested_at)}</span>
                </div>
                <div className="tl-grid">
                  <span>Mode</span><b>{c.mode === 'video' ? 'Video' : 'Voice'} · {c.language}</b>
                  <span>Expert</span><b>{c.agent_name || '—'}</b>
                  <span>Waited</span><b>{duration(c.wait_seconds)}</b>
                  <span>Talk time</span><b>{duration(c.duration_seconds)}</b>
                  <span>Rating</span><b><Rating value={c.rating} /></b>
                  <span>Outcome</span><b><OutcomeTag outcome={c.outcome} /></b>
                </div>
                {c.customer_requests?.length > 0 && <div style={{ marginTop: 8 }}><span className="tiny">Requested: </span><RequestTags items={c.customer_requests} /></div>}
                {c.agent_notes && <p className="note">“{c.agent_notes}”</p>}
                {c.feedback && <p className="note">Customer: “{c.feedback}”</p>}
              </div>
            ))}
          </div>

          {data.related.length > 0 && (
            <>
              <h4 className="section-title">Other submissions from this number</h4>
              <ul className="plain-list">
                {data.related.map((r) => <li key={r.id}>{r.name} · {r.city} · <span className="tiny">{dateTime(r.created_at)}</span></li>)}
              </ul>
            </>
          )}
        </>
      )}
    </Drawer>
  );
}
