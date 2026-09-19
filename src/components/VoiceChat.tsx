import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { 
  Mic, 
  MicOff, 
  Headphones, 
  Radio, 
  Users, 
  Crown, 
  PhoneOff, 
  Plus, 
  Search, 
  MoreVertical, 
  AlertCircle, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  X,
  Volume1
} from 'lucide-react';
import { VoiceRoom, VoiceParticipant } from '../types';

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
              {p.avatar ? (
                <img src={p.avatar} alt={p.username} className="w-full h-full object-cover" />
              ) : (
                <span>{p.username[0]?.toUpperCase()}</span>
              )}
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

// Memoized Participant Card for Inside Room
const VoiceParticipantCard = React.memo(({
  participant,
  isSelf,
  isHost,
  isCurrentRoomHost,
  onKick,
  onForceMute,
  onUserClick
}: {
  participant: VoiceParticipant;
  isSelf: boolean;
  isHost: boolean;
  isCurrentRoomHost: boolean;
  onKick?: (userId: number) => void;
  onForceMute?: (userId: number) => void;
  onUserClick?: (userId: number) => void;
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className={`relative bg-white dark:bg-slate-800/90 rounded-2xl p-4 sm:p-5 border transition-all flex flex-col items-center justify-center text-center shadow-sm ${
      participant.isSpeaking
        ? 'border-emerald-500/80 shadow-[0_0_20px_rgba(16,185,129,0.25)] ring-2 ring-emerald-500/40'
        : 'border-slate-200/80 dark:border-slate-700/80'
    }`}>
      {/* Top Badges & Actions */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
        {isHost ? (
          <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 text-[10px] font-bold flex items-center gap-1">
            <Crown size={11} />
            Host
          </span>
        ) : <span />}

        {/* Host controls for non-self participant */}
        {isCurrentRoomHost && !isSelf && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(prev => !prev)}
              aria-label="Yönetici İşlemleri"
              className="min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <MoreVertical size={16} />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onForceMute && onForceMute(participant.id);
                  }}
                  className="w-full min-h-[40px] px-3 py-2 text-left text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center gap-2 transition-colors"
                >
                  <MicOff size={14} />
                  <span>Sustur (Mute)</span>
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onKick && onKick(participant.id);
                  }}
                  className="w-full min-h-[40px] px-3 py-2 text-left text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center gap-2 transition-colors"
                >
                  <X size={14} />
                  <span>Odadan At (Kick)</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Avatar Container with Animated Speaking Ring */}
      <div 
        onClick={() => onUserClick && onUserClick(participant.id)}
        className="relative my-3 cursor-pointer group/avatar"
      >
        <div 
          className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center font-black text-xl sm:text-2xl text-white shadow-md overflow-hidden transition-all duration-200 ${
            participant.isSpeaking
              ? 'ring-4 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-800 scale-105 animate-pulse'
              : 'ring-2 ring-slate-100 dark:ring-slate-700'
          }`}
          style={{ backgroundColor: participant.color || '#3b82f6' }}
        >
          {participant.avatar ? (
            <img src={participant.avatar} alt={participant.username} className="w-full h-full object-cover" />
          ) : (
            <span>{participant.username[0]?.toUpperCase()}</span>
          )}
        </div>

        {/* Status Indicators overlaid on Avatar */}
        {participant.isMuted && (
          <div className="absolute -bottom-1 -right-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-rose-500 text-white flex items-center justify-center shadow border-2 border-white dark:border-slate-800">
            <MicOff size={12} />
          </div>
        )}
        {participant.isDeafened && (
          <div className="absolute -bottom-1 -left-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-slate-700 text-white flex items-center justify-center shadow border-2 border-white dark:border-slate-800">
            <VolumeX size={12} />
          </div>
        )}
      </div>

      {/* Username & Self Label */}
      <div className="w-full px-2">
        <p className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100 truncate">
          {participant.username} {isSelf && <span className="text-xs text-blue-500 font-medium">(Sen)</span>}
        </p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 flex items-center justify-center gap-1">
          {participant.isSpeaking ? (
            <span className="text-emerald-500 font-semibold flex items-center gap-1">
              <Volume2 size={12} className="animate-bounce" /> Konuşuyor
            </span>
          ) : participant.isMuted ? (
            <span className="text-rose-400">Sessizde</span>
          ) : (
            <span>Dinliyor</span>
          )}
        </p>
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

  // Audio & WebRTC State
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isSpeakingLocal, setIsSpeakingLocal] = useState(false);
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);

  // WebRTC Refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const speakingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMutedRef = useRef(isMuted);
  const isDeafenedRef = useRef(isDeafened);
  const currentRoomRef = useRef(currentRoom);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    isDeafenedRef.current = isDeafened;
  }, [isDeafened]);

  useEffect(() => {
    currentRoomRef.current = currentRoom;
  }, [currentRoom]);

  // Clean WebRTC streams and connections
  const cleanupWebRTC = useCallback(() => {
    if (speakingIntervalRef.current) {
      clearInterval(speakingIntervalRef.current);
      speakingIntervalRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    peerConnectionsRef.current.forEach((pc) => {
      pc.close();
    });
    peerConnectionsRef.current.clear();

    remoteAudioElementsRef.current.forEach((audio) => {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
    });
    remoteAudioElementsRef.current.clear();

    setIsSpeakingLocal(false);
    setMicPermissionError(null);
  }, []);

  // Setup Local Audio & Speaking Detector
  const setupLocalAudio = useCallback(async () => {
    try {
      cleanupWebRTC();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      localStreamRef.current = stream;

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
      console.warn("Microphone access failed or denied:", err);
      setMicPermissionError("Mikrofon erişimi sağlanamadı. Lütfen tarayıcı izinlerini kontrol edin.");
      return null;
    }
  }, [cleanupWebRTC, socket]);

  // Create Peer Connection for a remote user
  const createPeerConnection = useCallback((remoteSocketId: string, localStream: MediaStream | null) => {
    if (peerConnectionsRef.current.has(remoteSocketId)) {
      return peerConnectionsRef.current.get(remoteSocketId)!;
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current.set(remoteSocketId, pc);

    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        pc.addTrack(track, localStream);
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
        if (!stream) stream = await setupLocalAudio();
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
      alert(data.reason || "Oda kurucusu tarafından sesli odadan çıkarıldınız.");
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

    const handleUserStatusChanged = (data: { userId: number; isMuted?: boolean; isSpeaking?: boolean; isDeafened?: boolean }) => {
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
      if (!stream) stream = await setupLocalAudio();
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
      socket.off("voice_user_status_changed", handleUserStatusChanged);
      socket.off("voice_offer", handleVoiceOffer);
      socket.off("voice_answer", handleVoiceAnswer);
      socket.off("voice_ice_candidate", handleVoiceIceCandidate);
      cleanupWebRTC();
    };
  }, [socket, currentUserId, createPeerConnection, setupLocalAudio, cleanupWebRTC]);

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
        await setupLocalAudio();
      } else {
        alert(res?.message || "Oda oluşturulamadı.");
      }
    });
  };

  // Join Room Handler
  const handleJoinRoom = async (roomId: string) => {
    if (!socket) return;
    const stream = await setupLocalAudio();

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

  // Toggle Mute
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

  const filteredRooms = rooms.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.hostUsername.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isCurrentRoomHost = currentRoom?.hostId === currentUserId;

  return (
    <div className="flex-1 flex flex-col h-full w-full max-w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden select-none">
      
      {/* View 1: Inside Active Voice Room */}
      {currentRoom ? (
        <div className="flex-1 flex flex-col h-full w-full overflow-hidden relative">
          
          {/* Room Top Bar */}
          <div className="px-4 sm:px-6 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Radio size={22} className="animate-pulse" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 truncate">
                  {currentRoom.name}
                </h2>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
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
              className="min-h-[44px] px-3.5 sm:px-4 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all active:scale-95 shadow-sm shrink-0"
            >
              <PhoneOff size={16} />
              <span className="hidden xs:inline">Ayrıl</span>
            </button>
          </div>

          {/* Mic Permission Alert if error */}
          {micPermissionError && (
            <div className="mx-4 mt-3 p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{micPermissionError}</span>
            </div>
          )}

          {/* Participants Grid Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-28">
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {currentRoom.participants.map((participant) => (
                  <VoiceParticipantCard
                    key={participant.id}
                    participant={participant}
                    isSelf={participant.id === currentUserId}
                    isHost={participant.id === currentRoom.hostId}
                    isCurrentRoomHost={isCurrentRoomHost}
                    onKick={handleKickUser}
                    onForceMute={handleForceMuteUser}
                    onUserClick={onUserClick}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Floating Bottom Control Bar (Dock) */}
          <div className="absolute bottom-4 left-0 right-0 px-4 flex justify-center pointer-events-none z-20">
            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 sm:px-6 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex items-center gap-3 sm:gap-4 pointer-events-auto max-w-md w-full justify-around">
              
              {/* Mic Toggle Button */}
              <button
                onClick={handleToggleMute}
                title={isMuted ? "Mikrofonu Aç" : "Mikrofonu Kapat"}
                className={`min-w-[48px] min-h-[48px] rounded-xl flex items-center justify-center transition-all shadow-sm active:scale-95 ${
                  isMuted
                    ? 'bg-rose-500 hover:bg-rose-600 text-white'
                    : isSpeakingLocal
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white ring-2 ring-emerald-300 dark:ring-emerald-700 animate-pulse'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
              </button>

              {/* Deafen / Sound Toggle Button */}
              <button
                onClick={handleToggleDeafen}
                title={isDeafened ? "Sesi Aç" : "Kulaklığı Kapat (Sağırlaştır)"}
                className={`min-w-[48px] min-h-[48px] rounded-xl flex items-center justify-center transition-all shadow-sm active:scale-95 ${
                  isDeafened
                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                {isDeafened ? <VolumeX size={22} /> : <Headphones size={22} />}
              </button>

              {/* End / Leave Button */}
              <button
                onClick={handleLeaveRoom}
                title="Odadan Ayrıl"
                className="min-w-[48px] min-h-[48px] rounded-xl bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center transition-all shadow-sm active:scale-95"
              >
                <PhoneOff size={22} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* View 2: Voice Rooms Lobby */
        <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
          
          {/* Lobby Header */}
          <div className="p-4 sm:p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                    Sesli Sohbet Odaları
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs font-bold">
                    WebRTC P2P
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Arkadaşlarınla yüksek kaliteli, düşük gecikmeli sesli odalara katıl veya yeni oda kur.
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
                  <p className="text-sm font-medium">Sesli odalar taranıyor...</p>
                </div>
              ) : filteredRooms.length === 0 ? (
                <div className="bg-white dark:bg-slate-800/60 rounded-3xl p-8 sm:p-12 text-center border border-slate-200/80 dark:border-slate-700/80 max-w-md mx-auto my-8 shadow-sm">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4">
                    <Radio size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">
                    Aktif Sesli Oda Bulunmuyor
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-6">
                    İlk odayı kurarak arkadaşlarını sohbete davet edebilirsin!
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
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Radio size={20} />
                </div>
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
                  Yeni Sesli Oda Kur
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
                  <Radio size={16} />
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
