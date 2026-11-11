import { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { api, WEBSITE_URL } from '../../lib/api.js';
import { Empty, Modal, Spinner, useFetch, useToast } from '../../components/ui.jsx';
import { CopyIcon, DownloadIcon, PlusIcon, QrIcon } from '../../components/Icons.jsx';

export const storeUrl = (code, product) => {
  const p = new URLSearchParams({ store: code });
  if (product) p.set('product', product);
  return `${WEBSITE_URL}/?${p.toString()}`;
};

export default function Stores() {
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(() => api.get('/admin/stores'), []);
  const [editing, setEditing] = useState(null);
  const [qr, setQr] = useState(null);

  const toggle = async (s) => {
    try {
      await api.patch(`/admin/stores/${s.id}`, { isActive: !s.is_active });
      reload();
    } catch (e) { toast(e.message, 'bad'); }
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Stores &amp; QR codes</h1><p className="muted">Each store gets its own QR code so you can see where leads come from.</p></div>
        <button className="btn btn-primary" onClick={() => setEditing('new')}><PlusIcon /> Add store</button>
      </div>
      {error && <div className="alert alert-error">{error.message}</div>}
      <div className="card table-card">
        {loading && !data ? <div className="center-pad"><Spinner dark /></div> : !data?.items.length ? <Empty title="No stores yet">Add a store to generate its QR code.</Empty> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Code</th><th>Store</th><th>City / State</th><th>Default product</th><th className="num">Leads</th><th className="num">Calls done</th><th>Status</th><th /></tr></thead>
              <tbody>
                {data.items.map((s) => (
                  <tr key={s.id} className={s.is_active ? '' : 'inactive'}>
                    <td className="mono">{s.code}</td>
                    <td><b>{s.name}</b></td>
                    <td>{[s.city, s.state].filter(Boolean).join(', ') || '—'}</td>
                    <td>{s.default_product || '—'}</td>
                    <td className="num">{s.leads}</td>
                    <td className="num">{s.completed_calls}</td>
                    <td>{s.is_active ? <span className="yes">Active</span> : <span className="no">Disabled</span>}</td>
                    <td className="nowrap right">
                      <button className="btn btn-sm" onClick={() => setQr(s)}><QrIcon width="15" /> QR code</button>
                      <button className="btn btn-sm" onClick={() => setEditing(s)}>Edit</button>
                      <button className="btn btn-sm" onClick={() => toggle(s)}>{s.is_active ? 'Disable' : 'Enable'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editing && <StoreForm store={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      {qr && <QrModal store={qr} onClose={() => setQr(null)} />}
    </>
  );
}

function StoreForm({ store, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({ code: store?.code || '', name: store?.name || '', city: store?.city || '', state: store?.state || '', defaultProduct: store?.default_product || '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (store) await api.patch(`/admin/stores/${store.id}`, f);
      else await api.post('/admin/stores', f);
      toast(store ? 'Store updated' : 'Store added', 'good');
      onSaved();
    } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <Modal title={store ? 'Edit store' : 'Add store'} onClose={onClose}
      footer={<><button className="btn" type="button" onClick={onClose}>Cancel</button><button className="btn btn-primary" form="store-form" disabled={busy}>Save</button></>}>
      <form id="store-form" onSubmit={submit}>
        <label className="field"><span>Store code (used in the QR link)</span>
          <input className="input mono" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })} required placeholder="e.g. DEL-NP01" />
          {store && <small className="tiny">Changing the code breaks QR codes already printed.</small>}
        </label>
        <label className="field"><span>Store name</span><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required placeholder="e.g. Croma · Andheri West" /></label>
        <div className="row-2">
          <label className="field"><span>City</span><input className="input" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></label>
          <label className="field"><span>State</span><input className="input" value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} /></label>
        </div>
        <label className="field"><span>Default product on display</span><input className="input" value={f.defaultProduct} onChange={(e) => setF({ ...f, defaultProduct: e.target.value })} placeholder="e.g. EcoTank L3250" /></label>
        {error && <div className="alert alert-error">{error}</div>}
      </form>
    </Modal>
  );
}

function QrModal({ store, onClose }) {
  const toast = useToast();
  const [product, setProduct] = useState(store.default_product || '');
  const wrap = useRef(null);
  const url = storeUrl(store.code, product.trim() && product.trim() !== store.default_product ? product.trim() : '');

  const download = () => {
    const canvas = wrap.current?.querySelector('canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `epson-qr-${store.code}${product ? `-${product.replace(/\s+/g, '-')}` : ''}.png`;
    a.click();
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast('Link copied', 'good'); } catch { toast('Could not copy', 'bad'); }
  };

  return (
    <Modal title={`QR code · ${store.name}`} onClose={onClose}
      footer={<><button className="btn" onClick={copy}><CopyIcon /> Copy link</button><button className="btn btn-primary" onClick={download}><DownloadIcon /> Download PNG</button></>}>
      <label className="field"><span>Product on display (optional — one QR per demo unit)</span>
        <input className="input" value={product} onChange={(e) => setProduct(e.target.value)} placeholder="e.g. EcoTank L6460" />
      </label>
      <div className="qr-box" ref={wrap}>
        <div className="qr-card">
          <span className="wordmark">EPSON</span>
          <QRCodeCanvas value={url} size={240} level="M" marginSize={2} />
          <b>Scan to talk to an Epson expert</b>
          <span className="tiny">Free video or voice call</span>
        </div>
      </div>
      <p className="tiny mono break">{url}</p>
    </Modal>
  );
}
