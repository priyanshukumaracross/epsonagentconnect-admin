import { useState } from 'react';
import { api } from '../../lib/api.js';
import { OUTCOMES } from '../../lib/format.js';

/** Post-call outcome + notes. Used right after a call and from call history. */
export default function NotesForm({ callId, initial, onSaved, onSkip, compact }) {
  const [outcome, setOutcome] = useState(initial?.outcome || '');
  const [notes, setNotes] = useState(initial?.agent_notes || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!outcome) return setError('Pick an outcome');
    setBusy(true);
    setError('');
    try {
      const d = await api.patch(`/agent/calls/${callId}/notes`, { outcome, notes });
      onSaved?.(d.call);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={compact ? '' : 'notes-form'}>
      <div className="field">
        <span>Call outcome</span>
        <div className="chips">
          {Object.entries(OUTCOMES).map(([k, v]) => (
            <button type="button" key={k} className={`chip ${outcome === k ? 'on' : ''}`} onClick={() => setOutcome(k)}>{v}</button>
          ))}
        </div>
      </div>
      <label className="field">
        <span>Notes for the team (optional)</span>
        <textarea className="input" rows={4} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Wants EcoTank L3250 for home use, budget ₹15k, will buy this weekend" />
      </label>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="row-actions">
        {onSkip && <button type="button" className="btn" onClick={onSkip}>Skip</button>}
        <button className="btn btn-primary" disabled={busy}>Save notes</button>
      </div>
    </form>
  );
}
