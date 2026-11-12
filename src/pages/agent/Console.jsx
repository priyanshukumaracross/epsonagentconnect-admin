import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api.js';
import { createPeer, getMedia, mediaErrorMessage } from '../../lib/peer.js';
import { ago, clock, duration, initials, mobile, refId } from '../../lib/format.js';
import { useAuth, useRealtime } from '../../auth/AuthContext.jsx';
import { Empty, Rating, Spinner, useFetch, useToast } from '../../components/ui.jsx';
import { BellIcon, BellOffIcon, FlipIcon, HangupIcon, MicIcon, MicOffIcon, PhoneIcon, VideoIcon, VideoOffIcon } from '../../components/Icons.jsx';
import NotesForm from './NotesForm.jsx';

/* Short two-tone chime played while customers are waiting. */
function useRinger(active, enabled) {
  const ctxRef = useRef(null);
  useEffect(() => {
    if (!active || !enabled) return undefined;
    const ring = () => {
      try {
        ctxRef.current = ctxRef.current || new (window.AudioContext || window.webkitAudioContext)();
        const ctx = ctxRef.current;
        if (ctx.state === 'suspended') ctx.resume();
        [0, 0.25].forEach((offset, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.frequency.value = i ? 660 : 880;
          g.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
          g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + offset + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.22);
          o.connect(g).connect(ctx.destination);
          o.start(ctx.currentTime + offset);
          o.stop(ctx.currentTime + offset + 0.25);
        });
      } catch { /* audio not allowed yet */ }
    };
    ring();
    const t = setInterval(ring, 3000);
    return () => clearInterval(t);
  }, [active, enabled]);
}

export default function Console() {
  const { user } = useAuth();
  const { socket, queue, status, setStatusLocal } = useRealtime();
  const toast = useToast();

  const [active, setActive] = useState(null);      // call details while on a call
  const [phase, setPhase] = useState('idle');      // idle | connecting | connected | ended
  const [ended, setEnded] = useState(null);        // { status, duration, reason, call }
  const [accepting, setAccepting] = useState(null);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [mirror, setMirror] = useState(true);       // mirror self-view only for front/user cameras
  const [flipping, setFlipping] = useState(false);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [netIssue, setNetIssue] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [sound, setSound] = useState(() => { try { return localStorage.getItem('epson_ring') !== 'off'; } catch { return true; } });
  const [, setNow] = useState(0);

  const localRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const r = useRef({ stream: null, peer: null, earlyIce: [], ice: null, connectedAt: null, callId: null, mode: null, active: null });

  const stats = useFetch(() => api.get('/agent/stats'), [ended]);

  // live "waiting for" timers
  useEffect(() => { const t = setInterval(() => setNow((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { api.get('/public/ice').then((d) => { r.current.ice = d.iceServers; }).catch(() => {}); }, []);

  const ringing = queue.length > 0 && status === 'available' && !active;
  useRinger(ringing, sound);
  useEffect(() => {
    document.title = ringing ? `(${queue.length}) Customer waiting · Epson Console` : 'Epson Expert Connect · Console';
  }, [ringing, queue.length]);

  const cleanupMedia = useCallback(() => {
    const st = r.current;
    st.peer?.close();
    st.peer = null;
    st.stream?.getTracks().forEach((t) => t.stop());
    st.stream = null;
    st.earlyIce = [];
  }, []);

  useEffect(() => cleanupMedia, [cleanupMedia]);

  const handleEnded = useCallback((info) => {
    const st = r.current;
    if (!st.callId) return;
    const callId = st.callId;
    st.callId = null;
    const call = st.active;
    st.active = null;
    cleanupMedia();
    setPhase('ended');
    setStatusLocal('available');
    setEnded({ ...info, call, callId });
    setActive(null);
  }, [cleanupMedia, setStatusLocal]);

  // Leaving the console (or closing the tab) mid-call ends the call cleanly
  const socketRef = useRef(socket);
  socketRef.current = socket;
  useEffect(() => {
    const warn = (e) => { if (r.current.callId) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      if (r.current.callId) { socketRef.current?.emit('call:end'); r.current.callId = null; }
    };
  }, []);

  /* ---------- socket events for the active call ---------- */
  useEffect(() => {
    if (!socket) return undefined;

    const onSignal = async (msg) => {
      const st = r.current;
      if (!st.callId || !st.stream) return;
      try {
        if (msg.type === 'offer' && msg.restart && st.peer) {
          // customer is reconnecting the same call over a new network path
          await st.peer.handle(msg);
        } else if (msg.type === 'offer') {
          st.peer?.close();
          st.peer = createPeer({
            iceServers: st.ice || [],
            localStream: st.stream,
            recvVideo: st.mode === 'video',
            onSignal: (m) => socket.emit('signal', m),
            onRemoteStream: (stream) => {
              if (st.mode === 'video' && remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
              if (st.mode !== 'video' && remoteAudioRef.current) remoteAudioRef.current.srcObject = stream;
              setHasRemoteVideo(stream.getVideoTracks().length > 0);
            },
            onStateChange: (state) => {
              if (state === 'connected') {
                setNetIssue(false);
                if (!st.connectedAt) { st.connectedAt = Date.now(); setPhase('connected'); }
              }
              if (state === 'disconnected' || state === 'failed') setNetIssue(true);
            },
            // the customer's browser starts the reconnect (it created the offer)
            onNeedRestart: () => socket.emit('signal', { type: 'restart-request' }),
          });
          await st.peer.handle(msg);
          const early = st.earlyIce.splice(0);
          for (const m of early) await st.peer.handle(m);
        } else if (!st.peer) {
          st.earlyIce.push(msg);
        } else {
          await st.peer.handle(msg);
        }
      } catch (err) {
        console.error('signal error', err);
      }
    };

    const onEnded = (info) => handleEnded(info);

    socket.on('signal', onSignal);
    socket.on('call:ended', onEnded);
    return () => {
      socket.off('signal', onSignal);
      socket.off('call:ended', onEnded);
    };
  }, [socket, handleEnded]);

  useEffect(() => {
    if (phase !== 'connected') return undefined;
    const t = setInterval(() => setSeconds(Math.round((Date.now() - r.current.connectedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // attach local preview once the call view is mounted
  useEffect(() => {
    if (active && localRef.current && r.current.stream) localRef.current.srcObject = r.current.stream;
  }, [active]);

  /* ---------- actions ---------- */
  const accept = async (item) => {
    if (!socket || accepting || active) return;
    setAccepting(item.id);
    // fresh relay credentials for every call (the console may have been open for days)
    const icePromise = api.get('/public/ice').then((d) => d.iceServers).catch(() => null);
    let stream;
    try {
      stream = await getMedia(item.mode);
      const fresh = await icePromise;
      if (fresh?.length) r.current.ice = fresh;
    } catch (err) {
      toast(mediaErrorMessage(err), 'bad');
      setAccepting(null);
      return;
    }
    socket.timeout(10000).emit('call:accept', { callId: item.id }, (err, res) => {
      setAccepting(null);
      if (err || res?.error) {
        stream.getTracks().forEach((t) => t.stop());
        toast(res?.error || 'Could not accept the call. Try again.', 'bad');
        return;
      }
      Object.assign(r.current, { stream, peer: null, earlyIce: [], connectedAt: null, callId: item.id, mode: item.mode, active: res.call });
      setMuted(false);
      setCamOff(false);
      setMirror(stream.getVideoTracks()[0]?.getSettings().facingMode !== 'environment');
      setHasRemoteVideo(false);
      setNetIssue(false);
      setSeconds(0);
      setEnded(null);
      setActive(res.call);
      setPhase('connecting');
      setStatusLocal('busy');
      socket.emit('call:ready');
    });
  };

  const hangUp = () => {
    const callId = r.current.callId;
    socket?.emit('call:end');
    setTimeout(() => { if (r.current.callId === callId) handleEnded({ status: 'completed', reason: 'agent_ended' }); }, 4000);
  };

  const toggleMute = () => {
    const next = !muted;
    r.current.stream?.getAudioTracks().forEach((t) => { t.enabled = !next; });
    setMuted(next);
  };
  const toggleCam = () => {
    const next = !camOff;
    r.current.stream?.getVideoTracks().forEach((t) => { t.enabled = !next; });
    setCamOff(next);
  };
  /** Switch to the next camera (front/back on phones, built-in/external webcam on laptops). */
  const flipCam = async () => {
    const st = r.current;
    const old = st.stream?.getVideoTracks()[0];
    if (!old || flipping) return;
    setFlipping(true);
    const currentId = old.getSettings().deviceId;
    try {
      const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput' && d.deviceId);
      if (cams.length < 2) {
        toast('No other camera found on this device');
        return;
      }
      const idx = cams.findIndex((d) => d.deviceId === currentId);
      const next = cams[(idx + 1) % cams.length];
      old.stop(); // many phones can't open two cameras at the same time
      let ns;
      try {
        ns = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: next.deviceId } } });
      } catch {
        ns = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: currentId } } });
        toast('Could not open the other camera', 'bad');
      }
      const track = ns.getVideoTracks()[0];
      track.enabled = !camOff;
      await st.peer?.replaceVideoTrack(track);
      st.stream.removeTrack(old);
      st.stream.addTrack(track);
      if (localRef.current) localRef.current.srcObject = st.stream;
      const facing = track.getSettings().facingMode;
      setMirror(facing ? facing !== 'environment' : !/back|rear|environment/i.test(next.label));
    } catch (err) {
      console.error('flip camera failed', err);
      toast('Could not switch camera', 'bad');
    } finally {
      setFlipping(false);
    }
  };

  const toggleSound = () => {
    setSound((s) => { try { localStorage.setItem('epson_ring', s ? 'off' : 'on'); } catch { /* ignore */ } return !s; });
  };

  /* ---------- render ---------- */
  const s = stats.data?.stats;

  if (active) {
    const isVideo = active.mode === 'video';
    return (
      <div className="call-layout">
        <div className={`call-stage ${isVideo ? 'video' : 'voice'}`}>
          {isVideo && <video ref={remoteVideoRef} className="remote" autoPlay playsInline style={{ display: hasRemoteVideo ? 'block' : 'none' }} />}
          {!isVideo && <audio ref={remoteAudioRef} autoPlay />}
          {(!isVideo || !hasRemoteVideo) && (
            <div className="stage-center">
              <div className="avatar xl">{initials(active.customer_name)}</div>
              <b>{active.customer_name}</b>
              <span>{phase === 'connected' ? (isVideo ? 'Customer camera is off' : 'Voice call') : 'Connecting to customer…'}</span>
            </div>
          )}
          <div className="stage-top">
            <span className="stage-pill">{isVideo ? <VideoIcon width="14" /> : <PhoneIcon width="14" />}{isVideo ? 'Video' : 'Voice'} · {active.language}</span>
            <span className="stage-pill">{phase === 'connected' ? <><i className="dot dot-available" />{clock(seconds)}</> : 'Connecting…'}</span>
            {netIssue && <span className="stage-pill warn">Weak connection</span>}
          </div>
          {isVideo && (
            <div className="self-pip">
              <video ref={localRef} autoPlay playsInline muted className={mirror ? 'mirror' : ''} style={{ opacity: camOff ? 0 : 1 }} />
              {camOff && <span>Camera off</span>}
            </div>
          )}
          <div className="stage-controls">
            <button className={`round ${muted ? 'on' : ''}`} onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}>{muted ? <MicOffIcon /> : <MicIcon />}</button>
            {isVideo && <button className={`round ${camOff ? 'on' : ''}`} onClick={toggleCam} title="Camera on/off">{camOff ? <VideoOffIcon /> : <VideoIcon />}</button>}
            {isVideo && <button className="round" onClick={flipCam} disabled={flipping} title="Switch camera"><FlipIcon /></button>}
            <button className="round end" onClick={hangUp} title="End call"><HangupIcon /></button>
          </div>
        </div>

        <aside className="card customer-card">
          <span className="tiny">Customer · {refId(active.id)}</span>
          <h2>{active.customer_name}</h2>
          <a className="link" href={`tel:+91${active.mobile}`}>{mobile(active.mobile)}</a>
          <dl className="dl">
            <dt>Location</dt><dd>{active.city}, {active.state}</dd>
            <dt>Store</dt><dd>{active.store_name || '—'}</dd>
            <dt>Product</dt><dd>{active.product || '—'}</dd>
            <dt>Looking for</dt><dd>{active.interests?.length ? active.interests.join(', ') : '—'}</dd>
            <dt>Language</dt><dd>{active.language}</dd>
            <dt>Waited</dt><dd>{duration(Math.round((new Date(active.accepted_at) - new Date(active.requested_at)) / 1000))}</dd>
            <dt>Earlier calls</dt><dd>{active.previous_calls ? `${active.previous_calls} completed` : 'First call'}</dd>
          </dl>
          <div className="alert alert-info">Tip: show the product on camera, explain ink savings and running cost, and mention current store offers.</div>
        </aside>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Hi {user.name.split(' ')[0]} 👋</h1>
          <p className="muted">{status === 'available' ? 'You are available. Waiting customers appear below — accept to start the call.' : 'You are set to Away. Switch to Available (top right) to take calls.'}</p>
        </div>
        <button className="btn" onClick={toggleSound} title="Ring sound for waiting customers">
          {sound ? <BellIcon /> : <BellOffIcon />} Ring {sound ? 'on' : 'off'}
        </button>
      </div>

      <div className="kpis kpis-4">
        <div className="kpi card"><span className="kpi-label">Calls today</span><b className="kpi-value">{s?.completed_today ?? '—'}</b></div>
        <div className="kpi card"><span className="kpi-label">Talk time today</span><b className="kpi-value">{s ? duration(s.talk_time_today) : '—'}</b></div>
        <div className="kpi card"><span className="kpi-label">Your rating</span><b className="kpi-value"><Rating value={s?.avg_rating} /></b><span className="kpi-sub">{s?.completed_total ?? 0} calls overall</span></div>
        <div className="kpi card"><span className="kpi-label">Notes pending</span><b className="kpi-value">{s?.pending_notes ?? '—'}</b><span className="kpi-sub">Add outcomes in My calls</span></div>
      </div>

      {ended && (
        <div className="card ended-card">
          <div className="card-head">
            <div>
              <h3>{ended.status === 'completed' ? 'Call finished' : 'Call ended'}{ended.call ? ` · ${ended.call.customer_name}` : ''}</h3>
              <span className="tiny">
                {ended.duration ? `Duration ${duration(ended.duration)} · ` : ''}
                {ended.reason?.startsWith('customer') ? 'Customer ended the call' : 'You ended the call'}
              </span>
            </div>
          </div>
          {ended.status === 'completed' ? (
            <NotesForm callId={ended.callId} onSaved={() => { setEnded(null); setPhase('idle'); toast('Notes saved', 'good'); }} onSkip={() => { setEnded(null); setPhase('idle'); }} />
          ) : (
            <button className="btn" onClick={() => { setEnded(null); setPhase('idle'); }}>Dismiss</button>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h3>Waiting customers <span className="count">{queue.length}</span></h3>
          {ringing && <span className="ringing"><i className="dot dot-available" /> Customer waiting</span>}
        </div>
        {queue.length === 0 ? (
          <Empty title="No one is waiting right now">New requests appear here instantly with a ring.</Empty>
        ) : (
          <ul className="queue">
            {queue.map((q, i) => {
              const speaks = user.languages?.includes(q.language);
              return (
                <li key={q.id} className={i === 0 ? 'first' : ''}>
                  <div className="q-ic">{q.mode === 'video' ? <VideoIcon /> : <PhoneIcon />}</div>
                  <div className="q-main">
                    <b>{q.customer_name}</b>
                    <span className="tiny">{q.city}, {q.state}{q.store_name ? ` · ${q.store_name}` : ''}</span>
                    <span className="q-tags">
                      <span className="tag">{q.mode === 'video' ? 'Video' : 'Voice'}</span>
                      <span className={`tag ${speaks ? 'tag-interested' : 'tag-follow_up'}`}>{q.language}{speaks ? '' : ' (not in your list)'}</span>
                      {q.product && <span className="tag">{q.product}</span>}
                      {q.interests?.map((x) => <span key={x} className="tag">{x}</span>)}
                    </span>
                  </div>
                  <div className="q-wait"><span className="tiny">Waiting</span><b>{ago(q.requested_at)}</b></div>
                  <button className="btn btn-success" onClick={() => accept(q)} disabled={!!accepting || status === 'away'}>
                    {accepting === q.id ? <Spinner /> : <>{q.mode === 'video' ? <VideoIcon /> : <PhoneIcon />} Accept</>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
