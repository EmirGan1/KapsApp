import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { 
  Mic, 
  MicOff, 
  Video,
  VideoOff,
  Headphones, 
  Radio, 
  Users, 
  Crown, 
  PhoneOff, 
  Plus, 
  Search, 
  MoreVertical, 
  AlertCircle, 
  Volume2, 
  VolumeX, 
  X,
  Camera,
  CameraOff
} from 'lucide-react';
import { VoiceRoom, VoiceParticipant } from '../types';
import Avatar from './Avatar';

interface VoiceChatProps {
  socket: Socket | null;
  currentUserId: number;
  currentUsername: string;
  avatar: string | null;
  color?: string;
  onUserClick?: (userId: number) => void;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

// Memoized Voice Room Card for Lobby
const VoiceRoomCard = React.memo(({ 
  room, 
  onJoin 
}: { 
  room: VoiceRoom; 
  onJoin: (roomId: string) => void;
}) => {
  const count = room.participants.length;
  const isFull = count >= room.maxParticipants;
  const fillPercent = Math.min(100, Math.round((count / room.maxParticipants) * 100));

  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {room.name}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
              <Crown size={13} className="text-amber-500 shrink-0" />
              <span className="truncate">{room.hostUsername}</span>
            </div>
          </div>
          
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 flex items-center gap-1.5 ${
            isFull 
              ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400' 
              : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isFull ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'}`}></span>
            {count}/{room.maxParticipants}
          </span>
        </div>

        {/* Capacity Bar */}
        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-4">
          <div 
            className={`h-full transition-all duration-300 ${isFull ? 'bg-rose-500' : 'bg-blue-500'}`}
            style={{ width: `${fillPercent}%` }}
          />
        </div>

        {/* Participants Avatars Preview */}
        <div className="flex items-center gap-1.5 mb-4 overflow-hidden py-1">
          {room.participants.slice(0, 5).map((p) => (
            <div 
              key={p.id} 
              className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center font-bold text-xs text-white shadow-sm overflow-hidden shrink-0 relative"
              style={{ backgroundColor: p.color || '#3b82f6' }}
              title={p.username}
            >
              <Avatar url={p.avatar} color={p.color} name={p.username} size={8} />
              {p.isMuted && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <MicOff size={10} className="text-rose-400" />
                </div>
              )}
            </div>
          ))}
          {count > 5 && (
            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 border-2 border-white dark:border-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
              +{count - 5}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => onJoin(room.id)}
        disabled={isFull}
        className={`w-full min-h-[44px] py-2.5 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-sm ${
          isFull 
            ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-[0.98]'
        }`}
      >
        <Radio size={16} />
        <span>{isFull ? 'Oda Dolu' : 'Odaya Katıl'}</span>
      </button>
    </div>
  );
});

// Dynamic Video Participant Card for Inside Room
const VoiceVideoParticipantCard = React.memo(({
  participant,
  isSelf,
  isHost,
  isCurrentRoomHost,
  stream,
  isDeafened,
  onKick,
  onForceMute,
  onForceCameraOff,
  onUserClick
}: {
  participant: VoiceParticipant;
  isSelf: boolean;
  isHost: boolean;
  isCurrentRoomHost: boolean;
  stream: MediaStream | null;
  isDeafened: boolean;
  onKick?: (userId: number) => void;
  onForceMute?: (userId: number) => void;
  onForceCameraOff?: (userId: number) => void;
  onUserClick?: (userId: number) => void;
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Attach stream to video element
  useEffect(() => {
    if (videoRef.current) {
      if (stream && !participant.isVideoOff) {
        const hasVideoTracks = stream.getVideoTracks().some(t => t.readyState === 'live' && t.enabled !== false);
        if (hasVideoTracks || isSelf) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        } else {
          videoRef.current.srcObject = null;
        }
      } else {
        videoRef.current.srcObject = null;
      }
    }
  }, [stream, participant.isVideoOff, isSelf]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const showVideo = !participant.isVideoOff && stream && stream.getVideoTracks().length > 0;

  return (
    <div className={`relative w-full h-full min-h-[180px] sm:min-h-[220px] rounded-2xl overflow-hidden bg-slate-900 border transition-all duration-200 flex flex-col justify-between shadow-md ${
      participant.isSpeaking
        ? 'border-emerald-500 shadow-[0_0_24px_rgba(16,185,129,0.35)] ring-2 ring-emerald-500/70'
        : 'border-slate-800 hover:border-slate-700'
    }`}>
      
      {/* Video Stream Element */}
      {showVideo ? (
        <div className="absolute inset-0 w-full h-full bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isSelf || isDeafened}
            className={`w-full h-full object-cover ${isSelf ? 'scale-x-[-1]' : ''}`}
          />
        </div>
      ) : (
        /* Video Off: Centered Avatar Placeholder */
        <div 
          onClick={() => onUserClick && onUserClick(participant.id)}
          className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 cursor-pointer"
        >
          <div className="relative">
            <div 
              className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center font-black text-2xl sm:text-3xl text-white shadow-xl transition-all duration-300 ${
                participant.isSpeaking
                  ? 'ring-4 ring-emerald-500 ring-offset-4 ring-offset-slate-900 scale-105 animate-pulse'
                  : 'ring-2 ring-slate-700'
              }`}
            >
              <Avatar url={participant.avatar} color={participant.color} name={participant.username} size={20} />
            </div>

            {/* Camera Off Mini Badge */}
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-slate-800/90 text-slate-300 flex items-center justify-center border-2 border-slate-900 shadow">
              <CameraOff size={13} />
            </div>
          </div>
          <span className="text-[11px] text-slate-400 font-medium mt-3 bg-slate-800/70 px-2.5 py-0.5 rounded-full border border-slate-700/60">
            Kamera Kapalı
          </span>
        </div>
      )}

      {/* Top Overlay: Badges & Host Menu */}
      <div className="relative z-10 p-3 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-1.5">
          {isHost && (
            <span className="px-2 py-0.5 rounded-md bg-amber-500/90 text-slate-950 text-[10px] font-black flex items-center gap-1 shadow-sm backdrop-blur-xs">
              <Crown size={11} />
              Host
            </span>
          )}
          {participant.isMuted && (
            <span className="p-1 rounded-md bg-rose-600/90 text-white text-[10px] font-bold flex items-center shadow-sm backdrop-blur-xs" title="Mikrofon Kapalı">
              <MicOff size={12} />
            </span>
          )}
          {participant.isVideoOff && (
            <span className="p-1 rounded-md bg-slate-800/90 text-slate-300 text-[10px] font-bold flex items-center shadow-sm backdrop-blur-xs" title="Kamera Kapalı">
              <VideoOff size={12} />
            </span>
          )}
        </div>

        {/* Host Control Actions Dropdown */}
        {isCurrentRoomHost && !isSelf && (
          <div className="relative pointer-events-auto" ref={menuRef}>
            <button
              onClick={() => setShowMenu(prev => !prev)}
              aria-label="Yönetici İşlemleri"
              className="w-8 h-8 rounded-lg bg-black/50 hover:bg-black/80 text-white/80 hover:text-white flex items-center justify-center backdrop-blur-sm transition-colors border border-white/10"
            >
              <MoreVertical size={16} />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-slate-900 text-slate-100 rounded-xl shadow-2xl border border-slate-700 py-1.5 z-40 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 border-b border-slate-800 truncate">
                  {participant.username}
                </div>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onForceMute && onForceMute(participant.id);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-semibold text-amber-400 hover:bg-amber-950/40 flex items-center gap-2 transition-colors"
                >
                  <MicOff size={14} />
                  <span>Sustur (Mute)</span>
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onForceCameraOff && onForceCameraOff(participant.id);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-semibold text-blue-400 hover:bg-blue-950/40 flex items-center gap-2 transition-colors"
                >
                  <CameraOff size={14} />
                  <span>Kamerayı Kapatmaya Zorla</span>
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onKick && onKick(participant.id);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-semibold text-rose-400 hover:bg-rose-950/40 flex items-center gap-2 transition-colors"
                >
                  <X size={14} />
                  <span>Odadan At (Kick)</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Overlay: Name & Speaking Pulse */}
      <div className="relative z-10 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-xs sm:text-sm text-white truncate drop-shadow-sm">
            {participant.username} {isSelf && <span className="text-[11px] text-blue-400 font-medium">(Sen)</span>}
          </span>
        </div>

        {participant.isSpeaking ? (
          <div className="flex items-center gap-1 bg-emerald-500/90 text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm animate-pulse">
            <Volume2 size={11} />
            <span>Konuşuyor</span>
          </div>
        ) : participant.isMuted ? (
          <span className="text-[10px] text-rose-400 font-semibold bg-black/40 px-2 py-0.5 rounded-full">
            Sessizde
          </span>
        ) : null}
      </div>
    </div>
  );
});

export default function VoiceChat({
  socket,
  currentUserId,
  currentUsername,
  avatar,
  color,
  onUserClick
}: VoiceChatProps) {
  const [rooms, setRooms] = useState<VoiceRoom[]>([]);
  const [currentRoom, setCurrentRoom] = useState<VoiceRoom | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Creation Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCapacity, setNewRoomCapacity] = useState(8);
  const [isCreating, setIsCreating] = useState(false);

  // Media Controls State
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isSpeakingLocal, setIsSpeakingLocal] = useState(false);
  const [mediaPermissionError, setMediaPermissionError] = useState<string | null>(null);

  // Streams & WebRTC Refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const speakingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const isMutedRef = useRef(isMuted);
  const isVideoOffRef = useRef(isVideoOff);
  const isDeafenedRef = useRef(isDeafened);
  const currentRoomRef = useRef(currentRoom);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    isVideoOffRef.current = isVideoOff;
  }, [isVideoOff]);

  useEffect(() => {
    isDeafenedRef.current = isDeafened;
  }, [isDeafened]);

  useEffect(() => {
    currentRoomRef.current = currentRoom;
  }, [currentRoom]);

  // Clean WebRTC streams, peer connections, and hardware devices (turn off camera LED)
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
      localStreamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          console.warn("Error stopping track:", e);
        }
      });
      localStreamRef.current = null;
    }
    setLocalStream(null);

    // Close all P2P peer connections
    peerConnectionsRef.current.forEach((pc) => {
      try {
        pc.close();
      } catch (e) {
        console.warn("Error closing RTCPeerConnection:", e);
      }
    });
    peerConnectionsRef.current.clear();

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

  // Setup Local Media (Audio + Video)
  const setupLocalMedia = useCallback(async () => {
    try {
      cleanupWebRTC();

      let stream: MediaStream;
      try {
        // Attempt audio + video
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          }
        });
        setIsVideoOff(false);
      } catch (videoErr) {
        console.warn("Video + Audio getUserMedia failed, attempting audio only:", videoErr);
        // Fallback to audio only if camera is unavailable/denied
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false
        });
        setIsVideoOff(true);
      }

      localStreamRef.current = stream;
      setLocalStream(stream);

      // Check initial mute state
      stream.getAudioTracks().forEach(track => {
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
              if (socket && currentRoomRef.current) {
                socket.emit("voice_update_status", {
                  roomId: currentRoomRef.current.id,
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
          const isNowSpeaking = average > 18; // Sensible voice threshold

          if (isNowSpeaking !== wasSpeaking) {
            wasSpeaking = isNowSpeaking;
            setIsSpeakingLocal(isNowSpeaking);
            if (socket && currentRoomRef.current) {
              socket.emit("voice_update_status", {
                roomId: currentRoomRef.current.id,
                isSpeaking: isNowSpeaking
              });
            }
          }
        }, 120);
      }

      return stream;
    } catch (err: any) {
      console.warn("Media access failed or denied:", err);
      setMediaPermissionError("Kamera veya mikrofon erişimi sağlanamadı. Lütfen tarayıcı izinlerini kontrol edin.");
      return null;
    }
  }, [cleanupWebRTC, socket]);

  // Create Peer Connection for a remote user with both Audio and Video tracks
  const createPeerConnection = useCallback((remoteSocketId: string, currentLocalStream: MediaStream | null) => {
    if (peerConnectionsRef.current.has(remoteSocketId)) {
      return peerConnectionsRef.current.get(remoteSocketId)!;
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current.set(remoteSocketId, pc);

    // Add local tracks (audio and video)
    if (currentLocalStream) {
      currentLocalStream.getTracks().forEach(track => {
        pc.addTrack(track, currentLocalStream);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit("voice_ice_candidate", {
          targetSocketId: remoteSocketId,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        // Save stream in remoteStreams state for video rendering
        setRemoteStreams(prev => {
          const next = new Map(prev);
          next.set(remoteSocketId, remoteStream);
          return next;
        });

        // Setup audio element fallback for background audio playback
        let audioEl = remoteAudioElementsRef.current.get(remoteSocketId);
        if (!audioEl) {
          audioEl = new Audio();
          audioEl.autoplay = true;
          (audioEl as any).playsInline = true;
          remoteAudioElementsRef.current.set(remoteSocketId, audioEl);
          document.body.appendChild(audioEl);
        }
        audioEl.srcObject = remoteStream;
        audioEl.muted = isDeafenedRef.current;
        audioEl.play().catch(e => console.warn("Remote audio play blocked:", e));
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        const audioEl = remoteAudioElementsRef.current.get(remoteSocketId);
        if (audioEl) {
          audioEl.pause();
          audioEl.remove();
          remoteAudioElementsRef.current.delete(remoteSocketId);
        }
        setRemoteStreams(prev => {
          const next = new Map(prev);
          next.delete(remoteSocketId);
          return next;
        });
      }
    };

    return pc;
  }, [socket]);

  // Load Rooms list on mount
  useEffect(() => {
    if (!socket) return;

    socket.emit("get_voice_rooms", (roomList: VoiceRoom[]) => {
      setRooms(roomList || []);
      setIsLoading(false);
    });

    socket.emit("get_my_voice_room", (res: any) => {
      if (res && res.success && res.room) {
        setCurrentRoom(res.room);
      }
    });

    const handleRoomsList = (list: VoiceRoom[]) => {
      setRooms(list || []);
    };

    const handleRoomUpdated = (updatedRoom: VoiceRoom) => {
      if (currentRoomRef.current && currentRoomRef.current.id === updatedRoom.id) {
        setCurrentRoom(updatedRoom);
      }
      setRooms(prev => prev.map(r => r.id === updatedRoom.id ? updatedRoom : r));
    };

    const handleUserJoined = async (participant: VoiceParticipant) => {
      if (!currentRoomRef.current) return;
      setCurrentRoom(prev => prev ? {
        ...prev,
        participants: [...prev.participants.filter(p => p.id !== participant.id), participant]
      } : null);

      // Offer to the new participant
      if (participant.socketId && participant.id !== currentUserId) {
        let stream = localStreamRef.current;
        if (!stream) stream = await setupLocalMedia();
        const pc = createPeerConnection(participant.socketId, stream);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("voice_offer", {
            targetSocketId: participant.socketId,
            offer
          });
        } catch (err) {
          console.warn("Error creating voice offer:", err);
        }
      }
    };

    const handleUserLeft = (data: { userId: number; socketId: string }) => {
      if (currentRoomRef.current) {
        setCurrentRoom(prev => prev ? {
          ...prev,
          participants: prev.participants.filter(p => p.id !== data.userId)
        } : null);
      }

      if (data.socketId) {
        const pc = peerConnectionsRef.current.get(data.socketId);
        if (pc) {
          pc.close();
          peerConnectionsRef.current.delete(data.socketId);
        }
        const audioEl = remoteAudioElementsRef.current.get(data.socketId);
        if (audioEl) {
          audioEl.pause();
          audioEl.remove();
          remoteAudioElementsRef.current.delete(data.socketId);
        }
        setRemoteStreams(prev => {
          const next = new Map(prev);
          next.delete(data.socketId);
          return next;
        });
      }
    };

    const handleRoomClosed = (data: { reason?: string }) => {
      cleanupWebRTC();
      setCurrentRoom(null);
      alert(data.reason || "Oda kapatıldı.");
      socket.emit("get_voice_rooms", (roomList: VoiceRoom[]) => {
        setRooms(roomList || []);
      });
    };

    const handleKicked = (data: { reason?: string }) => {
      cleanupWebRTC();
      setCurrentRoom(null);
      alert(data.reason || "Oda kurucusu tarafından sesli/görüntülü odadan çıkarıldınız.");
      socket.emit("get_voice_rooms", (roomList: VoiceRoom[]) => {
        setRooms(roomList || []);
      });
    };

    const handleForceMute = (data: { reason?: string }) => {
      setIsMuted(true);
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = false; });
      }
      if (currentRoomRef.current) {
        socket.emit("voice_update_status", {
          roomId: currentRoomRef.current.id,
          isMuted: true
        });
      }
      alert(data.reason || "Oda kurucusu mikrofonunuzu kapattı.");
    };

    const handleForceCameraOff = (data: { reason?: string }) => {
      // Forcefully stop camera tracks to release hardware LED
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach(track => {
          track.stop();
          localStreamRef.current?.removeTrack(track);
        });
      }
      // Replace video track with null on all peers
      peerConnectionsRef.current.forEach((pc) => {
        const senders = pc.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(null).catch(() => {});
        }
      });

      setIsVideoOff(true);
      if (currentRoomRef.current) {
        socket.emit("voice_update_status", {
          roomId: currentRoomRef.current.id,
          isVideoOff: true
        });
      }
      alert(data.reason || "Oda kurucusu kameranızı kapattı.");
    };

    const handleUserStatusChanged = (data: { userId: number; isMuted?: boolean; isSpeaking?: boolean; isDeafened?: boolean; isVideoOff?: boolean }) => {
      if (currentRoomRef.current) {
        setCurrentRoom(prev => {
          if (!prev) return null;
          return {
            ...prev,
            participants: prev.participants.map(p => {
              if (p.id === data.userId) {
                return {
                  ...p,
                  isMuted: typeof data.isMuted === 'boolean' ? data.isMuted : p.isMuted,
                  isSpeaking: typeof data.isSpeaking === 'boolean' ? data.isSpeaking : p.isSpeaking,
                  isDeafened: typeof data.isDeafened === 'boolean' ? data.isDeafened : p.isDeafened,
                  isVideoOff: typeof data.isVideoOff === 'boolean' ? data.isVideoOff : p.isVideoOff
                };
              }
              return p;
            })
          };
        });
      }
    };

    // Signaling Handlers
    const handleVoiceOffer = async (data: { senderSocketId: string; senderUserId: number; offer: any }) => {
      let stream = localStreamRef.current;
      if (!stream) stream = await setupLocalMedia();
      const pc = createPeerConnection(data.senderSocketId, stream);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("voice_answer", {
          targetSocketId: data.senderSocketId,
          answer
        });
      } catch (err) {
        console.warn("Error handling voice offer:", err);
      }
    };

    const handleVoiceAnswer = async (data: { senderSocketId: string; answer: any }) => {
      const pc = peerConnectionsRef.current.get(data.senderSocketId);
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        } catch (err) {
          console.warn("Error handling voice answer:", err);
        }
      }
    };

    const handleVoiceIceCandidate = async (data: { senderSocketId: string; candidate: any }) => {
      const pc = peerConnectionsRef.current.get(data.senderSocketId);
      if (pc && data.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.warn("Error adding ICE candidate:", err);
        }
      }
    };

    socket.on("voice_rooms_list", handleRoomsList);
    socket.on("voice_room_updated", handleRoomUpdated);
    socket.on("voice_user_joined", handleUserJoined);
    socket.on("voice_user_left", handleUserLeft);
    socket.on("voice_room_closed", handleRoomClosed);
    socket.on("kick_from_voice", handleKicked);
    socket.on("voice_force_mute_received", handleForceMute);
    socket.on("voice_force_camera_off_received", handleForceCameraOff);
    socket.on("voice_user_status_changed", handleUserStatusChanged);
    socket.on("voice_offer", handleVoiceOffer);
    socket.on("voice_answer", handleVoiceAnswer);
    socket.on("voice_ice_candidate", handleVoiceIceCandidate);

    return () => {
      socket.off("voice_rooms_list", handleRoomsList);
      socket.off("voice_room_updated", handleRoomUpdated);
      socket.off("voice_user_joined", handleUserJoined);
      socket.off("voice_user_left", handleUserLeft);
      socket.off("voice_room_closed", handleRoomClosed);
      socket.off("kick_from_voice", handleKicked);
      socket.off("voice_force_mute_received", handleForceMute);
      socket.off("voice_force_camera_off_received", handleForceCameraOff);
      socket.off("voice_user_status_changed", handleUserStatusChanged);
      socket.off("voice_offer", handleVoiceOffer);
      socket.off("voice_answer", handleVoiceAnswer);
      socket.off("voice_ice_candidate", handleVoiceIceCandidate);
      cleanupWebRTC();
    };
  }, [socket, currentUserId, createPeerConnection, setupLocalMedia, cleanupWebRTC]);

  // Create Room Handler
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || isCreating) return;

    setIsCreating(true);
    socket.emit("create_voice_room", {
      name: newRoomName || `${currentUsername}'in Odası`,
      maxParticipants: newRoomCapacity
    }, async (res: any) => {
      setIsCreating(false);
      if (res && res.success && res.room) {
        setCurrentRoom(res.room);
        setShowCreateModal(false);
        setNewRoomName('');
        await setupLocalMedia();
      } else {
        alert(res?.message || "Oda oluşturulamadı.");
      }
    });
  };

  // Join Room Handler
  const handleJoinRoom = async (roomId: string) => {
    if (!socket) return;
    const stream = await setupLocalMedia();

    socket.emit("join_voice_room", { roomId }, async (res: any) => {
      if (res && res.success && res.room) {
        setCurrentRoom(res.room);

        // Connect to existing peers in the room
        if (res.existingPeers && Array.isArray(res.existingPeers)) {
          for (const peer of res.existingPeers) {
            if (peer.socketId && peer.id !== currentUserId) {
              const pc = createPeerConnection(peer.socketId, stream);
              try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.emit("voice_offer", {
                  targetSocketId: peer.socketId,
                  offer
                });
              } catch (err) {
                console.warn("Error sending offer to peer:", err);
              }
            }
          }
        }
      } else {
        cleanupWebRTC();
        alert(res?.message || "Odaya katılınamadı.");
      }
    });
  };

  // Leave Room Handler
  const handleLeaveRoom = () => {
    if (!socket) return;
    cleanupWebRTC();
    socket.emit("leave_voice_room");
    setCurrentRoom(null);
  };

  // Toggle Mute (Microphone)
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => {
        t.enabled = !nextMuted;
      });
    }

    if (socket && currentRoom) {
      socket.emit("voice_update_status", {
        roomId: currentRoom.id,
        isMuted: nextMuted
      });
    }
  };

  // Toggle Video (Camera)
  const handleToggleVideo = async () => {
    if (!isVideoOff) {
      // Turn Camera OFF: Stop tracks to turn off hardware LED and conserve bandwidth
      const videoTracks = localStreamRef.current?.getVideoTracks() || [];
      videoTracks.forEach(t => {
        t.stop();
        localStreamRef.current?.removeTrack(t);
      });

      // Replace with null track on all peer senders
      peerConnectionsRef.current.forEach((pc) => {
        const senders = pc.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(null).catch(() => {});
        }
      });

      setIsVideoOff(true);
      if (socket && currentRoom) {
        socket.emit("voice_update_status", {
          roomId: currentRoom.id,
          isVideoOff: true
        });
      }
    } else {
      // Turn Camera ON: Get new video stream and update senders
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          }
        });
        const newVideoTrack = camStream.getVideoTracks()[0];
        if (newVideoTrack) {
          if (!localStreamRef.current) {
            localStreamRef.current = new MediaStream();
          }
          localStreamRef.current.addTrack(newVideoTrack);
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));

          // Update video track in all active RTCPeerConnections
          for (const [sId, pc] of peerConnectionsRef.current.entries()) {
            const senders = pc.getSenders();
            const videoSender = senders.find(s => s.track && s.track.kind === 'video') || senders.find(s => !s.track);
            if (videoSender) {
              await videoSender.replaceTrack(newVideoTrack).catch(() => {});
            } else {
              pc.addTrack(newVideoTrack, localStreamRef.current);
              try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket?.emit("voice_offer", { targetSocketId: sId, offer });
              } catch (e) {
                console.warn("Renegotiation failed:", e);
              }
            }
          }

          setIsVideoOff(false);
          if (socket && currentRoom) {
            socket.emit("voice_update_status", {
              roomId: currentRoom.id,
              isVideoOff: false
            });
          }
        }
      } catch (err) {
        console.warn("Camera access failed:", err);
        alert("Kamera erişimi sağlanamadı. Lütfen tarayıcı kamera izinlerini kontrol edin.");
      }
    }
  };

  // Toggle Deafen (Kulaklık)
  const handleToggleDeafen = () => {
    const nextDeafen = !isDeafened;
    setIsDeafened(nextDeafen);

    // Mute all remote audio elements
    remoteAudioElementsRef.current.forEach(audio => {
      audio.muted = nextDeafen;
    });

    if (socket && currentRoom) {
      socket.emit("voice_update_status", {
        roomId: currentRoom.id,
        isDeafened: nextDeafen
      });
    }
  };

  // Host Action: Kick
  const handleKickUser = (targetUserId: number) => {
    if (!socket || !currentRoom) return;
    if (confirm("Bu kullanıcıyı odadan atmak istediğinize emin misiniz?")) {
      socket.emit("voice_kick_user", {
        roomId: currentRoom.id,
        targetUserId
      }, (res: any) => {
        if (!res?.success) {
          alert(res?.message || "Kullanıcı atılamadı.");
        }
      });
    }
  };

  // Host Action: Force Mute
  const handleForceMuteUser = (targetUserId: number) => {
    if (!socket || !currentRoom) return;
    socket.emit("voice_force_mute", {
      roomId: currentRoom.id,
      targetUserId
    }, (res: any) => {
      if (!res?.success) {
        alert(res?.message || "Kullanıcı susturulamadı.");
      }
    });
  };

  // Host Action: Force Camera Off
  const handleForceCameraOffUser = (targetUserId: number) => {
    if (!socket || !currentRoom) return;
    socket.emit("voice_force_camera_off", {
      roomId: currentRoom.id,
      targetUserId
    }, (res: any) => {
      if (!res?.success) {
        alert(res?.message || "Kamera kapatılamadı.");
      }
    });
  };

  const filteredRooms = rooms.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.hostUsername.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isCurrentRoomHost = currentRoom?.hostId === currentUserId;
  const participantCount = currentRoom?.participants.length || 1;

  // Compute dynamic grid classes based on participant count
  const getGridClasses = (count: number) => {
    if (count <= 1) return 'grid grid-cols-1 max-w-2xl mx-auto h-[62vh] sm:h-[68vh]';
    if (count === 2) return 'grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 h-[62vh] sm:h-[68vh]';
    if (count === 3 || count === 4) return 'grid grid-cols-2 gap-3 sm:gap-4 h-[62vh] sm:h-[68vh]';
    if (count === 5 || count === 6) return 'grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 h-[62vh] sm:h-[68vh]';
    return 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 auto-rows-fr';
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full max-w-full bg-slate-950 text-slate-100 overflow-hidden select-none">
      
      {/* View 1: Inside Active Video / Voice Room */}
      {currentRoom ? (
        <div className="flex-1 flex flex-col h-full w-full overflow-hidden relative bg-slate-950">
          
          {/* Room Top Bar */}
          <div className="px-4 sm:px-6 py-3 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between gap-4 shrink-0 shadow-sm z-20">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
                <Radio size={20} className="animate-pulse" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-black text-white truncate">
                  {currentRoom.name}
                </h2>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="flex items-center gap-1 font-medium">
                    <Crown size={12} className="text-amber-500" />
                    {currentRoom.hostUsername}
                  </span>
                  <span>•</span>
                  <span>{currentRoom.participants.length}/{currentRoom.maxParticipants} Kişi</span>
                </div>
              </div>
            </div>

            {/* Leave Room Button */}
            <button
              onClick={handleLeaveRoom}
              className="min-h-[40px] px-3.5 sm:px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all active:scale-95 shadow-sm shrink-0"
            >
              <PhoneOff size={16} />
              <span className="hidden xs:inline">Ayrıl</span>
            </button>
          </div>

          {/* Media Permission Alert if error */}
          {mediaPermissionError && (
            <div className="mx-4 mt-3 p-3 bg-amber-950/60 border border-amber-800/80 rounded-xl text-amber-300 text-xs flex items-center gap-2 shrink-0">
              <AlertCircle size={16} className="shrink-0 text-amber-400" />
              <span>{mediaPermissionError}</span>
            </div>
          )}

          {/* Dynamic Video Grid Area */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-5 pb-28 flex flex-col justify-center">
            <div className="w-full max-w-6xl mx-auto h-full flex flex-col justify-center">
              <div className={getGridClasses(participantCount)}>
                {currentRoom.participants.map((participant) => {
                  const isSelf = participant.id === currentUserId;
                  const stream = isSelf ? localStream : (remoteStreams.get(participant.socketId) || null);

                  return (
                    <VoiceVideoParticipantCard
                      key={participant.id}
                      participant={participant}
                      isSelf={isSelf}
                      isHost={participant.id === currentRoom.hostId}
                      isCurrentRoomHost={isCurrentRoomHost}
                      stream={stream}
                      isDeafened={isDeafened}
                      onKick={handleKickUser}
                      onForceMute={handleForceMuteUser}
                      onForceCameraOff={handleForceCameraOffUser}
                      onUserClick={onUserClick}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Floating Bottom Control Bar (Dock) */}
          <div className="absolute bottom-4 left-0 right-0 px-4 flex justify-center pointer-events-none z-30">
            <div className="bg-slate-900/95 backdrop-blur-xl px-5 sm:px-8 py-3 rounded-2xl border border-slate-800 shadow-2xl flex items-center gap-3 sm:gap-5 pointer-events-auto max-w-lg w-full justify-around">
              
              {/* Mic Toggle Button */}
              <button
                onClick={handleToggleMute}
                title={isMuted ? "Mikrofonu Aç" : "Mikrofonu Kapat"}
                className={`min-w-[48px] min-h-[48px] rounded-xl flex items-center justify-center transition-all shadow-md active:scale-95 ${
                  isMuted
                    ? 'bg-rose-600 hover:bg-rose-500 text-white ring-2 ring-rose-500/30'
                    : isSpeakingLocal
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-4 ring-emerald-500/40 animate-pulse'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
              >
                {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
              </button>

              {/* Camera Toggle Button */}
              <button
                onClick={handleToggleVideo}
                title={isVideoOff ? "Kamerayı Aç" : "Kamerayı Kapat"}
                className={`min-w-[48px] min-h-[48px] rounded-xl flex items-center justify-center transition-all shadow-md active:scale-95 ${
                  isVideoOff
                    ? 'bg-rose-600 hover:bg-rose-500 text-white ring-2 ring-rose-500/30'
                    : 'bg-blue-600 hover:bg-blue-500 text-white ring-2 ring-blue-500/30'
                }`}
              >
                {isVideoOff ? <CameraOff size={22} /> : <Camera size={22} />}
              </button>

              {/* Deafen / Sound Toggle Button */}
              <button
                onClick={handleToggleDeafen}
                title={isDeafened ? "Sesi Aç" : "Kulaklığı Kapat (Sağırlaştır)"}
                className={`min-w-[48px] min-h-[48px] rounded-xl flex items-center justify-center transition-all shadow-md active:scale-95 ${
                  isDeafened
                    ? 'bg-amber-600 hover:bg-amber-500 text-white ring-2 ring-amber-500/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
              >
                {isDeafened ? <VolumeX size={22} /> : <Headphones size={22} />}
              </button>

              {/* End / Leave Button */}
              <button
                onClick={handleLeaveRoom}
                title="Odadan Ayrıl"
                className="min-w-[48px] min-h-[48px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition-all shadow-md active:scale-95"
              >
                <PhoneOff size={22} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* View 2: Voice & Video Rooms Lobby */
        <div className="flex-1 flex flex-col h-full w-full overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
          
          {/* Lobby Header */}
          <div className="p-4 sm:p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                    Sesli & Görüntülü Sohbet Odaları
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs font-bold">
                    WebRTC P2P Kamera & Ses
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Arkadaşlarınla yüksek kaliteli, düşük gecikmeli sesli ve kameralı odalara katıl veya yeni oda kur.
                </p>
              </div>

              {/* Create Room Button */}
              <button
                onClick={() => setShowCreateModal(true)}
                className="min-h-[44px] px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm shadow-blue-500/20 active:scale-95 transition-all self-stretch sm:self-auto"
              >
                <Plus size={18} />
                <span>Oda Kur</span>
              </button>
            </div>

            {/* Search Bar */}
            <div className="max-w-6xl mx-auto mt-4">
              <div className="relative">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Oda adı veya kurucu adına göre ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full min-h-[44px] pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* Rooms Grid / Empty State */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="max-w-6xl mx-auto">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                  <p className="text-sm font-medium">Odalar taranıyor...</p>
                </div>
              ) : filteredRooms.length === 0 ? (
                <div className="bg-white dark:bg-slate-800/60 rounded-3xl p-8 sm:p-12 text-center border border-slate-200/80 dark:border-slate-700/80 max-w-md mx-auto my-8 shadow-sm">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4">
                    <Video size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">
                    Aktif Oda Bulunmuyor
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-6">
                    İlk odayı kurarak arkadaşlarını sesli ve görüntülü sohbete davet edebilirsin!
                  </p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="min-h-[44px] w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
                  >
                    <Plus size={18} />
                    <span>Hemen Oda Kur</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredRooms.map((room) => (
                    <VoiceRoomCard
                      key={room.id}
                      room={room}
                      onJoin={handleJoinRoom}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-150 text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Video size={20} />
                </div>
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
                  Yeni Sesli & Görüntülü Oda Kur
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Oda Adı
                </label>
                <input
                  type="text"
                  placeholder={`${currentUsername}'in Odası`}
                  value={newRoomName}
                  maxLength={35}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Maksimum Kişi Sayısı
                  </label>
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 rounded-md">
                    {newRoomCapacity} Kişi
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1.5 pt-1">
                  {[2, 4, 6, 8, 10].map((cap) => (
                    <button
                      key={cap}
                      type="button"
                      onClick={() => setNewRoomCapacity(cap)}
                      className={`min-h-[44px] rounded-xl text-xs font-bold transition-all ${
                        newRoomCapacity === cap
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {cap}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="min-h-[44px] px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="min-h-[44px] px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-bold rounded-xl shadow-md shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-2"
                >
                  <Video size={16} />
                  <span>{isCreating ? 'Oluşturuluyor...' : 'Odayı Kur'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
