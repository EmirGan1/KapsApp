import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Headphones, 
  PhoneOff, 
  Crown, 
  Camera, 
  CameraOff, 
  MoreVertical, 
  X, 
  VolumeX, 
  AlertCircle,
  Radio
} from 'lucide-react';
import { VoiceParticipant } from '../types';
import Avatar from './Avatar';
import RemoteVideo from './RemoteVideo';

interface VideoTileProps {
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
}

export const VideoTile = React.memo(({
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
}: VideoTileProps) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Check if stream has active video track
  const videoTrack = stream ? stream.getVideoTracks()[0] : null;
  const hasLiveVideoTrack = Boolean(
    videoTrack && 
    videoTrack.readyState === 'live' && 
    videoTrack.enabled && 
    !participant.isVideoOff
  );

  // Outside click handler for host control dropdown
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

  const showVideo = hasLiveVideoTrack && isVideoPlaying;

  return (
    <div className={`relative w-full h-full min-h-[140px] sm:min-h-[170px] rounded-2xl overflow-hidden bg-slate-900 border transition-all duration-200 flex flex-col justify-between shadow-md group ${
      participant.isSpeaking
        ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.35)] ring-2 ring-emerald-500/80'
        : 'border-slate-800 hover:border-slate-700'
    }`}>
      
      {/* Video Stream Element with Anti-Black Screen RemoteVideo Component */}
      {hasLiveVideoTrack && (
        <div className={`absolute inset-0 w-full h-full bg-black transition-opacity duration-300 ${
          showVideo ? 'opacity-100 z-0' : 'opacity-0 -z-10'
        }`}>
          <RemoteVideo
            stream={stream}
            isSelf={isSelf}
            muted={true}
            onVideoPlaying={setIsVideoPlaying}
          />
        </div>
      )}

      {/* Video Off / Fallback: Centered Avatar Placeholder */}
      {!showVideo && (
        <div 
          onClick={() => onUserClick && onUserClick(participant.id)}
          className="absolute inset-0 flex flex-col items-center justify-center p-3 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 cursor-pointer select-none"
        >
          <div className="relative">
            <div 
              className={`w-14 h-14 sm:w-20 sm:h-20 rounded-full flex items-center justify-center font-black text-xl sm:text-2xl text-white shadow-xl transition-all duration-300 ${
                participant.isSpeaking
                  ? 'ring-4 ring-emerald-500 ring-offset-4 ring-offset-slate-900 scale-105 animate-pulse'
                  : 'ring-2 ring-slate-700'
              }`}
            >
              <Avatar url={participant.avatar} color={participant.color} name={participant.username} size={14} />
            </div>

            {/* Camera Off Mini Badge */}
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-800/90 text-slate-300 flex items-center justify-center border-2 border-slate-900 shadow">
              <CameraOff size={11} />
            </div>
          </div>
          <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium mt-2.5 bg-slate-800/70 px-2 py-0.5 rounded-full border border-slate-700/60">
            Kamera Kapalı
          </span>
        </div>
      )}

      {/* Top Overlay: Badges & Host Actions Menu */}
      <div className="relative z-10 p-2 sm:p-2.5 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
          {isHost && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/90 text-slate-950 text-[10px] font-black flex items-center gap-1 shadow-sm">
              <Crown size={10} />
              Host
            </span>
          )}
          {participant.isMuted && (
            <span className="p-1 rounded bg-rose-600/90 text-white text-[10px] font-bold flex items-center shadow-sm" title="Mikrofon Kapalı">
              <MicOff size={11} />
            </span>
          )}
          {participant.isVideoOff && (
            <span className="p-1 rounded bg-slate-800/90 text-slate-300 text-[10px] font-bold flex items-center shadow-sm" title="Kamera Kapalı">
              <VideoOff size={11} />
            </span>
          )}
        </div>

        {/* Host Control Actions Dropdown */}
        {isCurrentRoomHost && !isSelf && (
          <div className="relative pointer-events-auto" ref={menuRef}>
            <button
              onClick={() => setShowMenu((prev) => !prev)}
              aria-label="Yönetici İşlemleri"
              className="w-7 h-7 rounded-lg bg-black/60 hover:bg-black/80 text-white/80 hover:text-white flex items-center justify-center backdrop-blur-sm transition-colors border border-white/10"
            >
              <MoreVertical size={14} />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-slate-900 text-slate-100 rounded-xl shadow-2xl border border-slate-700 py-1.5 z-40 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1 text-[11px] font-bold text-slate-400 border-b border-slate-800 truncate">
                  {participant.username}
                </div>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onForceMute && onForceMute(participant.id);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-semibold text-amber-400 hover:bg-amber-950/40 flex items-center gap-2 transition-colors"
                >
                  <MicOff size={13} />
                  <span>Sustur (Mute)</span>
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onForceCameraOff && onForceCameraOff(participant.id);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-semibold text-blue-400 hover:bg-blue-950/40 flex items-center gap-2 transition-colors"
                >
                  <CameraOff size={13} />
                  <span>Kamerayı Kapatmaya Zorla</span>
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onKick && onKick(participant.id);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-semibold text-rose-400 hover:bg-rose-950/40 flex items-center gap-2 transition-colors"
                >
                  <X size={13} />
                  <span>Odadan At (Kick)</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Overlay: Participant Name & Speaking Pulse */}
      <div className="relative z-10 p-2 sm:p-2.5 bg-gradient-to-t from-black/85 via-black/40 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs sm:text-sm font-bold text-white truncate drop-shadow-sm">
            {participant.username} {isSelf && '(Sen)'}
          </span>
        </div>

        {participant.isSpeaking && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/40 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            Konuşuyor
          </span>
        )}
      </div>
    </div>
  );
});

VideoTile.displayName = 'VideoTile';

interface VideoRoomViewProps {
  roomName: string;
  hostUsername: string;
  maxParticipants: number;
  participants: VoiceParticipant[];
  currentUserId: number;
  isHost: boolean;
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  isMuted: boolean;
  isVideoOff: boolean;
  isDeafened: boolean;
  isSpeakingLocal: boolean;
  mediaPermissionError: string | null;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleDeafen: () => void;
  onLeaveRoom: () => void;
  onKickUser?: (userId: number) => void;
  onForceMuteUser?: (userId: number) => void;
  onForceCameraOffUser?: (userId: number) => void;
  onUserClick?: (userId: number) => void;
}

export function VideoRoomView({
  roomName,
  hostUsername,
  maxParticipants,
  participants,
  currentUserId,
  isHost,
  localStream,
  remoteStreams,
  isMuted,
  isVideoOff,
  isDeafened,
  isSpeakingLocal,
  mediaPermissionError,
  onToggleMute,
  onToggleVideo,
  onToggleDeafen,
  onLeaveRoom,
  onKickUser,
  onForceMuteUser,
  onForceCameraOffUser,
  onUserClick
}: VideoRoomViewProps) {
  const count = participants.length;

  // Optimized grid class generator tailored for up to 20 users
  const getGridClasses = (total: number) => {
    if (total <= 1) return 'grid grid-cols-1 max-w-xl mx-auto h-[60vh]';
    if (total === 2) return 'grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-4xl mx-auto h-[62vh]';
    if (total <= 4) return 'grid grid-cols-2 gap-2.5 sm:gap-3 max-w-4xl mx-auto h-[64vh]';
    if (total <= 6) return 'grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 max-w-5xl mx-auto h-[64vh]';
    if (total <= 9) return 'grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-6xl mx-auto auto-rows-fr';
    if (total <= 12) return 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-w-6xl mx-auto auto-rows-fr';
    if (total <= 16) return 'grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-7xl mx-auto auto-rows-fr';
    // 17 - 20 users (High density view)
    return 'grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 max-w-7xl mx-auto auto-rows-fr';
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full overflow-hidden relative bg-slate-950">
      
      {/* Top Header Bar */}
      <div className="px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between gap-4 shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
            <Radio size={18} className="animate-pulse" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-black text-white truncate">
              {roomName}
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="flex items-center gap-1 font-medium">
                <Crown size={12} className="text-amber-500" />
                {hostUsername}
              </span>
              <span>•</span>
              <span className="font-semibold text-blue-400">{count}/{maxParticipants} Kişi</span>
            </div>
          </div>
        </div>

        {/* Leave Room Button */}
        <button
          onClick={onLeaveRoom}
          className="min-h-[38px] px-3.5 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all active:scale-95 shadow-sm shrink-0"
        >
          <PhoneOff size={15} />
          <span className="hidden xs:inline">Ayrıl</span>
        </button>
      </div>

      {/* Permission alert */}
      {mediaPermissionError && (
        <div className="mx-4 mt-3 p-3 bg-amber-950/60 border border-amber-800/80 rounded-xl text-amber-300 text-xs flex items-center gap-2 shrink-0">
          <AlertCircle size={16} className="shrink-0 text-amber-400" />
          <span>{mediaPermissionError}</span>
        </div>
      )}

      {/* Scrollable Video Tiles Grid */}
      <div className="flex-1 overflow-y-auto p-2.5 sm:p-4 pb-28 flex flex-col justify-center">
        <div className="w-full h-full flex flex-col justify-center">
          <div className={getGridClasses(count)}>
            {participants.map((participant) => {
              const isSelf = participant.id === currentUserId;
              const stream = isSelf 
                ? localStream 
                : (remoteStreams.get(participant.socketId) || null);

              return (
                <VideoTile
                  key={participant.id}
                  participant={participant}
                  isSelf={isSelf}
                  isHost={participant.isHost}
                  isCurrentRoomHost={isHost}
                  stream={stream}
                  isDeafened={isDeafened}
                  onKick={onKickUser}
                  onForceMute={onForceMuteUser}
                  onForceCameraOff={onForceCameraOffUser}
                  onUserClick={onUserClick}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Floating Bottom Control Dock */}
      <div className="absolute bottom-4 left-0 right-0 px-4 flex justify-center pointer-events-none z-30">
        <div className="bg-slate-900/95 backdrop-blur-xl px-5 sm:px-8 py-2.5 sm:py-3 rounded-2xl border border-slate-800 shadow-2xl flex items-center gap-3 sm:gap-5 pointer-events-auto max-w-md w-full justify-around">
          
          {/* Mic Button */}
          <button
            onClick={onToggleMute}
            title={isMuted ? 'Mikrofonu Aç' : 'Mikrofonu Kapat'}
            className={`min-w-[46px] min-h-[46px] rounded-xl flex items-center justify-center transition-all shadow-md active:scale-95 ${
              isMuted
                ? 'bg-rose-600 hover:bg-rose-500 text-white ring-2 ring-rose-500/30'
                : isSpeakingLocal
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-4 ring-emerald-500/40 animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          {/* Camera Button */}
          <button
            onClick={onToggleVideo}
            title={isVideoOff ? 'Kamerayı Aç' : 'Kamerayı Kapat'}
            className={`min-w-[46px] min-h-[46px] rounded-xl flex items-center justify-center transition-all shadow-md active:scale-95 ${
              isVideoOff
                ? 'bg-rose-600 hover:bg-rose-500 text-white ring-2 ring-rose-500/30'
                : 'bg-blue-600 hover:bg-blue-500 text-white ring-2 ring-blue-500/30'
            }`}
          >
            {isVideoOff ? <CameraOff size={20} /> : <Camera size={20} />}
          </button>

          {/* Deafen Button */}
          <button
            onClick={onToggleDeafen}
            title={isDeafened ? 'Sesi Aç' : 'Kulaklığı Kapat (Sağırlaştır)'}
            className={`min-w-[46px] min-h-[46px] rounded-xl flex items-center justify-center transition-all shadow-md active:scale-95 ${
              isDeafened
                ? 'bg-amber-600 hover:bg-amber-500 text-white ring-2 ring-amber-500/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            {isDeafened ? <VolumeX size={20} /> : <Headphones size={20} />}
          </button>

          {/* Leave Button */}
          <button
            onClick={onLeaveRoom}
            title="Odadan Ayrıl"
            className="min-w-[46px] min-h-[46px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition-all shadow-md active:scale-95"
          >
            <PhoneOff size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
