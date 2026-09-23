import { useState, useRef, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { 
  ICE_SERVERS, 
  AUDIO_CONSTRAINTS, 
  getVideoConstraints, 
  applySenderBitrateLimit, 
  tuneSdpForAudioOpus 
} from '../utils/webrtcConfig';

interface UseWebRTCOptions {
  socket: Socket | null;
  currentUserId: number;
  roomId?: string;
  participantCount?: number;
}

export function useWebRTC({
  socket,
  currentUserId,
  roomId,
  participantCount = 1
}: UseWebRTCOptions) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isSpeakingLocal, setIsSpeakingLocal] = useState(false);
  const [mediaPermissionError, setMediaPermissionError] = useState<string | null>(null);

  // References
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const speakingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // State refs to access latest values in async callbacks
  const isMutedRef = useRef(isMuted);
  const isVideoOffRef = useRef(isVideoOff);
  const isDeafenedRef = useRef(isDeafened);
  const roomIdRef = useRef(roomId);
  const participantCountRef = useRef(participantCount);

  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { isVideoOffRef.current = isVideoOff; }, [isVideoOff]);
  useEffect(() => { isDeafenedRef.current = isDeafened; }, [isDeafened]);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);
  useEffect(() => { participantCountRef.current = participantCount; }, [participantCount]);

  // Clean WebRTC streams, peer connections, and audio hardware
  const cleanupWebRTC = useCallback(() => {
    if (speakingIntervalRef.current) {
      clearInterval(speakingIntervalRef.current);
      speakingIntervalRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    // Stop all local tracks explicitly to turn off camera LED and mic
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn('[WebRTC] Error stopping track:', e);
        }
      });
      localStreamRef.current = null;
    }
    setLocalStream(null);

    // Close all P2P peer connections and clear listeners
    peerConnectionsRef.current.forEach((pc) => {
      try {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.onconnectionstatechange = null;
        pc.close();
      } catch (e) {
        console.warn('[WebRTC] Error closing RTCPeerConnection:', e);
      }
    });
    peerConnectionsRef.current.clear();
    pendingCandidatesRef.current.clear();

    // Clean remote audio elements
    remoteAudioElementsRef.current.forEach((audio) => {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
    });
    remoteAudioElementsRef.current.clear();

    setRemoteStreams(new Map());
    setIsSpeakingLocal(false);
    setMediaPermissionError(null);
  }, []);

  // Process queued ICE candidates after remote description is set
  const processQueuedCandidates = async (remoteSocketId: string, pc: RTCPeerConnection) => {
    const queue = pendingCandidatesRef.current.get(remoteSocketId);
    if (queue && queue.length > 0) {
      while (queue.length > 0) {
        const candidate = queue.shift();
        if (candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.debug('[WebRTC] Failed to apply queued ICE candidate:', e);
          }
        }
      }
    }
    pendingCandidatesRef.current.delete(remoteSocketId);
  };

  // Setup Local Media (Audio + Video) with adaptive constraints
  const setupLocalMedia = useCallback(async (preferVideo: boolean = true) => {
    try {
      cleanupWebRTC();

      let stream: MediaStream;
      const vConstraints = getVideoConstraints(participantCountRef.current);

      if (preferVideo) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: AUDIO_CONSTRAINTS,
            video: vConstraints
          });
          setIsVideoOff(false);
        } catch (videoErr) {
          console.warn('[WebRTC] Camera access failed, falling back to audio only:', videoErr);
          stream = await navigator.mediaDevices.getUserMedia({
            audio: AUDIO_CONSTRAINTS,
            video: false
          });
          setIsVideoOff(true);
        }
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: AUDIO_CONSTRAINTS,
          video: false
        });
        setIsVideoOff(true);
      }

      localStreamRef.current = stream;
      setLocalStream(stream);

      // Check initial mute state
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !isMutedRef.current;
      });

      // Web Audio API Speaking Detection
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let wasSpeaking = false;

        speakingIntervalRef.current = setInterval(() => {
          if (isMutedRef.current || !analyserRef.current) {
            if (wasSpeaking) {
              wasSpeaking = false;
              setIsSpeakingLocal(false);
              if (socket && roomIdRef.current) {
                socket.emit('voice_update_status', {
                  roomId: roomIdRef.current,
                  isSpeaking: false
                });
              }
            }
            return;
          }

          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          const isNowSpeaking = average > 18;

          if (isNowSpeaking !== wasSpeaking) {
            wasSpeaking = isNowSpeaking;
            setIsSpeakingLocal(isNowSpeaking);
            if (socket && roomIdRef.current) {
              socket.emit('voice_update_status', {
                roomId: roomIdRef.current,
                isSpeaking: isNowSpeaking
              });
            }
          }
        }, 120);
      }

      return stream;
    } catch (err: any) {
      console.warn('[WebRTC] Media access error:', err);
      setMediaPermissionError('Kamera veya mikrofon erişimi sağlanamadı. Lütfen tarayıcı izinlerini kontrol edin.');
      return null;
    }
  }, [cleanupWebRTC, socket]);

  // Create Peer Connection with pre-allocated Video & Audio Transceivers
  const createPeerConnection = useCallback((remoteSocketId: string, currentLocalStream: MediaStream | null) => {
    if (peerConnectionsRef.current.has(remoteSocketId)) {
      return peerConnectionsRef.current.get(remoteSocketId)!;
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current.set(remoteSocketId, pc);

    // 1. Transceivers & Track Configuration
    const audioTrack = currentLocalStream?.getAudioTracks()[0] || null;
    const videoTrack = currentLocalStream?.getVideoTracks()[0] || null;

    if (audioTrack) {
      pc.addTrack(audioTrack, currentLocalStream!);
    } else {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
    }

    if (videoTrack) {
      const sender = pc.addTrack(videoTrack, currentLocalStream!);
      applySenderBitrateLimit(sender, participantCountRef.current);
    } else {
      pc.addTransceiver('video', { direction: 'sendrecv' });
    }

    // 2. ICE Candidate Event
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('voice_ice_candidate', {
          targetSocketId: remoteSocketId,
          candidate: event.candidate
        });
      }
    };

    // 3. Remote Track Handling (Robust implementation resolving Black Screen Bug)
    pc.ontrack = (event) => {
      const track = event.track;
      console.log(`[WebRTC] ontrack received: peer=${remoteSocketId}, kind=${track.kind}, id=${track.id}`);

      // Track unmute event: when first data packet arrives from remote peer
      track.onunmute = () => {
        console.log(`[WebRTC] Remote track onunmute (active data): peer=${remoteSocketId}, kind=${track.kind}`);
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          const current = next.get(remoteSocketId);
          if (current) {
            // New MediaStream instance forces React ref callbacks and useEffects to trigger
            next.set(remoteSocketId, new MediaStream(current.getTracks()));
          }
          return next;
        });
      };

      track.onmute = () => {
        console.log(`[WebRTC] Remote track onmute: peer=${remoteSocketId}, kind=${track.kind}`);
      };

      // Add to remoteStreams Map
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        const existing = next.get(remoteSocketId);
        if (existing) {
          if (!existing.getTracks().some((t) => t.id === track.id)) {
            existing.addTrack(track);
          }
          next.set(remoteSocketId, new MediaStream(existing.getTracks()));
        } else {
          const newStream = event.streams && event.streams[0] 
            ? event.streams[0] 
            : new MediaStream([track]);
          next.set(remoteSocketId, newStream);
        }
        return next;
      });

      // Background HTMLAudioElement for uninterrupted audio playback
      if (track.kind === 'audio') {
        let audioEl = remoteAudioElementsRef.current.get(remoteSocketId);
        if (!audioEl) {
          audioEl = new Audio();
          audioEl.autoplay = true;
          (audioEl as any).playsInline = true;
          remoteAudioElementsRef.current.set(remoteSocketId, audioEl);
          document.body.appendChild(audioEl);
        }
        audioEl.srcObject = new MediaStream([track]);
        audioEl.muted = isDeafenedRef.current;
        audioEl.play().catch((e) => console.debug('[WebRTC] Remote audio autoplay:', e));
      }
    };

    // 4. Connection State Management
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state with ${remoteSocketId}:`, pc.connectionState);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        const audioEl = remoteAudioElementsRef.current.get(remoteSocketId);
        if (audioEl) {
          audioEl.pause();
          audioEl.remove();
          remoteAudioElementsRef.current.delete(remoteSocketId);
        }
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.delete(remoteSocketId);
          return next;
        });
      }
    };

    return pc;
  }, [socket]);

  // Toggle Mute (Microphone)
  const toggleMute = useCallback(() => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !nextMuted;
      });
    }

    if (socket && roomIdRef.current) {
      socket.emit('voice_update_status', {
        roomId: roomIdRef.current,
        isMuted: nextMuted
      });
    }
  }, [isMuted, socket]);

  // Toggle Video (Camera) with Full Renegotiation & Track Replacement
  const toggleVideo = useCallback(async () => {
    if (!isVideoOff) {
      // 1. Turn Camera OFF: Stop tracks so hardware indicator LED turns off
      const videoTracks = localStreamRef.current?.getVideoTracks() || [];
      videoTracks.forEach((t) => {
        t.stop();
        localStreamRef.current?.removeTrack(t);
      });

      // Replace sender track with null across all active peer connections
      peerConnectionsRef.current.forEach((pc) => {
        const senders = pc.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(null).catch(() => {});
        }
      });

      setIsVideoOff(true);
      if (localStreamRef.current) {
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      }

      if (socket && roomIdRef.current) {
        socket.emit('voice_update_status', {
          roomId: roomIdRef.current,
          isVideoOff: true
        });
      }
    } else {
      // 2. Turn Camera ON: Get new video stream, replaceTrack, and Renegotiate with all peers!
      try {
        const vConstraints = getVideoConstraints(participantCountRef.current);
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: vConstraints
        });
        const newVideoTrack = camStream.getVideoTracks()[0];

        if (newVideoTrack) {
          if (!localStreamRef.current) {
            localStreamRef.current = new MediaStream();
          }
          localStreamRef.current.addTrack(newVideoTrack);
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));

          // Update each peer connection
          for (const [sId, pc] of peerConnectionsRef.current.entries()) {
            const senders = pc.getSenders();
            const videoSender = senders.find((s) => s.track?.kind === 'video') || senders.find((s) => !s.track);

            if (videoSender) {
              await videoSender.replaceTrack(newVideoTrack).catch(() => {});
              applySenderBitrateLimit(videoSender, participantCountRef.current);
            } else {
              const sender = pc.addTrack(newVideoTrack, localStreamRef.current);
              applySenderBitrateLimit(sender, participantCountRef.current);
            }

            // CRITICAL RENEGOTIATION: Send offer to guarantee remote SDP receives video
            try {
              const rawOffer = await pc.createOffer();
              const tunedSdp = tuneSdpForAudioOpus(rawOffer.sdp || '');
              const offer = { type: rawOffer.type, sdp: tunedSdp };
              await pc.setLocalDescription(offer);
              socket?.emit('voice_offer', { targetSocketId: sId, offer });
            } catch (renegErr) {
              console.warn('[WebRTC] Renegotiation offer notice:', renegErr);
            }
          }

          setIsVideoOff(false);
          if (socket && roomIdRef.current) {
            socket.emit('voice_update_status', {
              roomId: roomIdRef.current,
              isVideoOff: false
            });
          }
        }
      } catch (err) {
        console.warn('[WebRTC] Camera enable failed:', err);
        alert('Kamera açılamadı. Lütfen kamera izinlerini kontrol edin.');
      }
    }
  }, [isVideoOff, socket]);

  // Toggle Deafen (Kulaklık)
  const toggleDeafen = useCallback(() => {
    const nextDeafen = !isDeafened;
    setIsDeafened(nextDeafen);

    remoteAudioElementsRef.current.forEach((audio) => {
      audio.muted = nextDeafen;
    });

    if (socket && roomIdRef.current) {
      socket.emit('voice_update_status', {
        roomId: roomIdRef.current,
        isDeafened: nextDeafen
      });
    }
  }, [isDeafened, socket]);

  // Host force actions
  const handleRemoteForceMute = useCallback(() => {
    setIsMuted(true);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = false; });
    }
    if (socket && roomIdRef.current) {
      socket.emit('voice_update_status', {
        roomId: roomIdRef.current,
        isMuted: true
      });
    }
  }, [socket]);

  const handleRemoteForceCameraOff = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.stop();
        localStreamRef.current?.removeTrack(track);
      });
    }
    peerConnectionsRef.current.forEach((pc) => {
      const senders = pc.getSenders();
      const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
      if (videoSender) {
        videoSender.replaceTrack(null).catch(() => {});
      }
    });

    setIsVideoOff(true);
    if (socket && roomIdRef.current) {
      socket.emit('voice_update_status', {
        roomId: roomIdRef.current,
        isVideoOff: true
      });
    }
  }, [socket]);

  // Connect to a peer (called when a user joins)
  const initiateOfferToPeer = useCallback(async (targetSocketId: string) => {
    if (!socket || !targetSocketId) return;
    let stream = localStreamRef.current;
    if (!stream) stream = await setupLocalMedia();

    const pc = createPeerConnection(targetSocketId, stream);
    try {
      const rawOffer = await pc.createOffer();
      const tunedSdp = tuneSdpForAudioOpus(rawOffer.sdp || '');
      const offer = { type: rawOffer.type, sdp: tunedSdp };
      await pc.setLocalDescription(offer);

      socket.emit('voice_offer', {
        targetSocketId,
        offer
      });
    } catch (err) {
      console.warn('[WebRTC] Error creating voice offer:', err);
    }
  }, [socket, setupLocalMedia, createPeerConnection]);

  // Remove peer connection and free resources
  const removePeerConnection = useCallback((remoteSocketId: string) => {
    const pc = peerConnectionsRef.current.get(remoteSocketId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(remoteSocketId);
    }
    pendingCandidatesRef.current.delete(remoteSocketId);

    const audioEl = remoteAudioElementsRef.current.get(remoteSocketId);
    if (audioEl) {
      audioEl.pause();
      audioEl.remove();
      remoteAudioElementsRef.current.delete(remoteSocketId);
    }

    setRemoteStreams((prev) => {
      const next = new Map(prev);
      next.delete(remoteSocketId);
      return next;
    });
  }, []);

  // WebRTC Signaling Socket Listeners (handles both initial and renegotiation offers)
  useEffect(() => {
    if (!socket) return;

    const handleVoiceOffer = async (data: { senderSocketId: string; senderUserId: number; offer: any }) => {
      console.log(`[WebRTC] Received voice_offer from ${data.senderSocketId}`);
      let stream = localStreamRef.current;
      if (!stream) stream = await setupLocalMedia();

      // Retrieve existing connection or create a new one
      const pc = peerConnectionsRef.current.get(data.senderSocketId) || createPeerConnection(data.senderSocketId, stream);

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        await processQueuedCandidates(data.senderSocketId, pc);

        const rawAnswer = await pc.createAnswer();
        const tunedSdp = tuneSdpForAudioOpus(rawAnswer.sdp || '');
        const answer = { type: rawAnswer.type, sdp: tunedSdp };
        await pc.setLocalDescription(answer);

        socket.emit('voice_answer', {
          targetSocketId: data.senderSocketId,
          answer
        });
      } catch (err) {
        console.warn('[WebRTC] Error handling voice offer/renegotiation:', err);
      }
    };

    const handleVoiceAnswer = async (data: { senderSocketId: string; answer: any }) => {
      console.log(`[WebRTC] Received voice_answer from ${data.senderSocketId}`);
      const pc = peerConnectionsRef.current.get(data.senderSocketId);
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          await processQueuedCandidates(data.senderSocketId, pc);
        } catch (err) {
          console.warn('[WebRTC] Error handling voice answer:', err);
        }
      }
    };

    const handleVoiceIceCandidate = async (data: { senderSocketId: string; candidate: any }) => {
      if (!data?.senderSocketId || !data?.candidate) return;
      const pc = peerConnectionsRef.current.get(data.senderSocketId);

      // Only add candidate immediately if remote description is set
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.warn('[WebRTC] Error adding ICE candidate:', err);
        }
      } else {
        // Queue candidates until remote description is applied
        const queue = pendingCandidatesRef.current.get(data.senderSocketId) || [];
        queue.push(data.candidate);
        pendingCandidatesRef.current.set(data.senderSocketId, queue);
      }
    };

    socket.on('voice_offer', handleVoiceOffer);
    socket.on('voice_answer', handleVoiceAnswer);
    socket.on('voice_ice_candidate', handleVoiceIceCandidate);

    return () => {
      socket.off('voice_offer', handleVoiceOffer);
      socket.off('voice_answer', handleVoiceAnswer);
      socket.off('voice_ice_candidate', handleVoiceIceCandidate);
    };
  }, [socket, setupLocalMedia, createPeerConnection]);

  return {
    localStream,
    remoteStreams,
    isMuted,
    isVideoOff,
    isDeafened,
    isSpeakingLocal,
    mediaPermissionError,
    setupLocalMedia,
    toggleMute,
    toggleVideo,
    toggleDeafen,
    cleanupWebRTC,
    initiateOfferToPeer,
    removePeerConnection,
    handleRemoteForceMute,
    handleRemoteForceCameraOff
  };
}
