/**
 * Thin wrapper around RTCPeerConnection used for customer <-> agent calls.
 * Signaling messages ({type:'offer'|'answer'|'ice'|'restart-request'}) are carried over Socket.IO.
 * (Same file exists in website/src/lib/peer.js.)
 *
 * Self-healing: if the media path breaks (network switch, Wi-Fi drop, relay hiccup) the
 * connection goes "disconnected"/"failed" and onNeedRestart is called. The caller (customer)
 * then runs restartIce(); the answering side (expert) asks the caller with 'restart-request'.
 */
const DISCONNECT_GRACE_MS = 4000;  // "disconnected" often recovers by itself within a few seconds
const RESTART_EVERY_MS = 10000;    // keep retrying while not connected

/** Drop STUN/TURN entries the browser can't parse: one bad URL would otherwise make the whole call fail. */
export function usableIceServers(iceServers = []) {
  return iceServers.flatMap((server) => {
    const urls = [].concat(server.urls || []).filter((url) => {
      try { new RTCPeerConnection({ iceServers: [{ ...server, urls: url }] }).close(); return true; } catch {
        console.warn('Ignoring invalid ICE server URL:', url);
        return false;
      }
    });
    return urls.length ? [{ ...server, urls }] : [];
  });
}

function newConnection(iceServers) {
  try { return new RTCPeerConnection({ iceServers }); } catch { return new RTCPeerConnection({ iceServers: usableIceServers(iceServers) }); }
}

export function createPeer({ iceServers, localStream, recvVideo, onSignal, onRemoteStream, onStateChange, onNeedRestart }) {
  const pc = newConnection(iceServers);
  const pendingIce = [];
  let watchdog = null;
  let lastRestart = 0;

  localStream?.getTracks().forEach((t) => pc.addTrack(t, localStream));
  if (!localStream?.getAudioTracks().length) pc.addTransceiver('audio', { direction: 'recvonly' });
  if (recvVideo && !localStream?.getVideoTracks().length) pc.addTransceiver('video', { direction: 'recvonly' });

  pc.ontrack = (e) => onRemoteStream?.(e.streams[0] || new MediaStream([e.track]));
  pc.onicecandidate = (e) => { if (e.candidate) onSignal({ type: 'ice', candidate: e.candidate.toJSON() }); };
  pc.onconnectionstatechange = () => {
    const state = pc.connectionState;
    onStateChange?.(state);
    clearTimeout(watchdog);
    if (state === 'failed') needRestart();
    else if (state === 'disconnected') watchdog = setTimeout(() => needRestart(), DISCONNECT_GRACE_MS);
  };

  // force: the other side reported a broken path even though ours may still look connected
  function needRestart(force = false) {
    clearTimeout(watchdog);
    if (!onNeedRestart || pc.signalingState === 'closed') return;
    if (!force && pc.connectionState === 'connected') return;
    const wait = lastRestart + RESTART_EVERY_MS - Date.now();
    if (wait > 0) { watchdog = setTimeout(() => needRestart(force), wait); return; }
    lastRestart = Date.now();
    Promise.resolve(onNeedRestart()).catch((err) => console.warn('ICE restart failed', err));
    watchdog = setTimeout(() => needRestart(), RESTART_EVERY_MS); // still not connected -> try again
  }

  async function flushIce() {
    while (pendingIce.length) {
      try { await pc.addIceCandidate(pendingIce.shift()); } catch (err) { console.warn('ICE candidate rejected', err); }
    }
  }

  return {
    pc,
    async makeOffer() {
      await pc.setLocalDescription(await pc.createOffer());
      onSignal({ type: 'offer', sdp: pc.localDescription.toJSON() });
    },
    /** Caller side: new network path for the same call (keeps tracks and encryption). */
    async restartIce(freshIceServers) {
      if (pc.signalingState === 'closed') return;
      if (freshIceServers?.length) {
        const apply = (list) => pc.setConfiguration({ ...pc.getConfiguration(), iceServers: list });
        try { apply(freshIceServers); } catch { try { apply(usableIceServers(freshIceServers)); } catch (err) { console.warn(err); } }
      }
      if (pc.signalingState !== 'stable') return;
      await pc.setLocalDescription(await pc.createOffer({ iceRestart: true }));
      onSignal({ type: 'offer', restart: true, sdp: pc.localDescription.toJSON() });
    },
    /** The other side reports a broken connection. */
    requestRestart: () => needRestart(true),
    async handle(msg) {
      if (!msg || pc.signalingState === 'closed') return;
      if (msg.type === 'offer') {
        await pc.setRemoteDescription(msg.sdp);
        await flushIce();
        await pc.setLocalDescription(await pc.createAnswer());
        onSignal({ type: 'answer', sdp: pc.localDescription.toJSON() });
      } else if (msg.type === 'answer') {
        if (pc.signalingState !== 'have-local-offer') return;
        await pc.setRemoteDescription(msg.sdp);
        await flushIce();
      } else if (msg.type === 'ice' && msg.candidate) {
        if (pc.remoteDescription) await pc.addIceCandidate(msg.candidate).catch((e) => console.warn(e));
        else pendingIce.push(msg.candidate);
      }
    },
    async replaceVideoTrack(track) {
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(track);
    },
    close() {
      clearTimeout(watchdog);
      pc.ontrack = pc.onicecandidate = pc.onconnectionstatechange = null;
      try { pc.close(); } catch { /* already closed */ }
    },
  };
}

/** Get mic (+camera for video calls). Falls back to audio-only if the camera is unavailable. */
export async function getMedia(mode, facingMode = 'user') {
  if (!navigator.mediaDevices?.getUserMedia) {
    const err = new Error('Camera and microphone need a secure (https) connection.');
    err.name = 'InsecureContext';
    throw err;
  }
  const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
  if (mode === 'video') {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio, video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } } });
    } catch (err) {
      console.warn('Camera unavailable, falling back to audio only', err);
    }
  }
  return navigator.mediaDevices.getUserMedia({ audio, video: false });
}

export function mediaErrorMessage(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Microphone access was blocked. Please allow microphone (and camera) access in your browser settings, then tap Try again.';
    case 'NotFoundError':
      return 'No microphone was found on this device.';
    case 'NotReadableError':
      return 'Your microphone is being used by another app. Close it and tap Try again.';
    case 'InsecureContext':
      return 'Calls need a secure (https) connection. Please open this page using the https link.';
    default:
      return 'We could not access your microphone. Please check permissions and try again.';
  }
}
