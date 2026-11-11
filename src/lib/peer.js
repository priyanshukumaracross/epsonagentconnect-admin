/**
 * Thin wrapper around RTCPeerConnection used for customer <-> agent calls.
 * Signaling messages ({type:'offer'|'answer'|'ice'}) are carried over Socket.IO.
 * (Same file exists in website/src/lib/peer.js.)
 */
export function createPeer({ iceServers, localStream, recvVideo, onSignal, onRemoteStream, onStateChange }) {
  const pc = new RTCPeerConnection({ iceServers });
  const pendingIce = [];

  localStream?.getTracks().forEach((t) => pc.addTrack(t, localStream));
  if (!localStream?.getAudioTracks().length) pc.addTransceiver('audio', { direction: 'recvonly' });
  if (recvVideo && !localStream?.getVideoTracks().length) pc.addTransceiver('video', { direction: 'recvonly' });

  pc.ontrack = (e) => onRemoteStream?.(e.streams[0] || new MediaStream([e.track]));
  pc.onicecandidate = (e) => { if (e.candidate) onSignal({ type: 'ice', candidate: e.candidate.toJSON() }); };
  pc.onconnectionstatechange = () => onStateChange?.(pc.connectionState);

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
