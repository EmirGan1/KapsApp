import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { 
  Video, 
  Radio, 
  Crown, 
  Plus, 
  Search, 
  X, 
  MicOff 
} from 'lucide-react';
import { VoiceRoom, VoiceParticipant } from '../types';
import Avatar from './Avatar';
import { useWebRTC } from '../hooks/useWebRTC';
import { VideoRoomView } from './VideoRoom';
import { MAX_ROOM_USERS } from '../utils/webrtcConfig';

interface VoiceChatProps {
  socket: Socket | null;
  currentUserId: number;
  currentUsername: string;
  avatar: string | null;
  color?: string;
  onUserClick?: (userId: number) => void;
}

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

VoiceRoomCard.displayName = 'VoiceRoomCard';

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

  // Creation Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCapacity, setNewRoomCapacity] = useState(8);
  const [isCreating, setIsCreating] = useState(false);

  const currentRoomRef = useRef<VoiceRoom | null>(null);
  useEffect(() => {
    currentRoomRef.current = currentRoom;
  }, [currentRoom]);

  // Hook-based WebRTC management
  const {
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
  } = useWebRTC({
    socket,
    currentUserId,
    roomId: currentRoom?.id,
    participantCount: currentRoom?.participants.length || 1
  });

  // Load Rooms list on mount
  useEffect(() => {
    if (!socket) return;

    socket.emit('get_voice_rooms', (roomList: VoiceRoom[]) => {
      setRooms(roomList || []);
      setIsLoading(false);
    });

    socket.emit('get_my_voice_room', (res: any) => {
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
      setRooms((prev) => prev.map((r) => (r.id === updatedRoom.id ? updatedRoom : r)));
    };

    // When a new user joins, update participants & initiate WebRTC offer
    const handleUserJoined = (participant: VoiceParticipant) => {
      if (!currentRoomRef.current) return;
      setCurrentRoom((prev) =>
        prev
          ? {
              ...prev,
              participants: [
                ...prev.participants.filter((p) => p.id !== participant.id),
                participant
              ]
            }
          : null
      );

      // Offer to the new participant
      if (participant.socketId && participant.id !== currentUserId) {
        initiateOfferToPeer(participant.socketId);
      }
    };

    const handleUserLeft = (data: { userId: number; socketId: string }) => {
      if (currentRoomRef.current) {
        setCurrentRoom((prev) =>
          prev
            ? {
                ...prev,
                participants: prev.participants.filter((p) => p.id !== data.userId)
              }
            : null
        );
      }
      if (data.socketId) {
        removePeerConnection(data.socketId);
      }
    };

    const handleRoomClosed = (data: { reason?: string }) => {
      cleanupWebRTC();
      setCurrentRoom(null);
      alert(data.reason || 'Oda kapatıldı.');
      socket.emit('get_voice_rooms', (roomList: VoiceRoom[]) => {
        setRooms(roomList || []);
      });
    };

    const handleKicked = (data: { reason?: string }) => {
      cleanupWebRTC();
      setCurrentRoom(null);
      alert(data.reason || 'Oda kurucusu tarafından sesli/görüntülü odadan çıkarıldınız.');
      socket.emit('get_voice_rooms', (roomList: VoiceRoom[]) => {
        setRooms(roomList || []);
      });
    };

    const handleForceMuteReceived = (data: { reason?: string }) => {
      handleRemoteForceMute();
      alert(data.reason || 'Oda kurucusu mikrofonunuzu kapattı.');
    };

    const handleForceCameraOffReceived = (data: { reason?: string }) => {
      handleRemoteForceCameraOff();
      alert(data.reason || 'Oda kurucusu kameranızı kapattı.');
    };

    const handleUserStatusChanged = (data: {
      userId: number;
      isMuted?: boolean;
      isSpeaking?: boolean;
      isDeafened?: boolean;
      isVideoOff?: boolean;
    }) => {
      if (currentRoomRef.current) {
        setCurrentRoom((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            participants: prev.participants.map((p) => {
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

    socket.on('voice_rooms_list', handleRoomsList);
    socket.on('voice_room_updated', handleRoomUpdated);
    socket.on('voice_user_joined', handleUserJoined);
    socket.on('voice_user_left', handleUserLeft);
    socket.on('voice_room_closed', handleRoomClosed);
    socket.on('kick_from_voice', handleKicked);
    socket.on('voice_force_mute_received', handleForceMuteReceived);
    socket.on('voice_force_camera_off_received', handleForceCameraOffReceived);
    socket.on('voice_user_status_changed', handleUserStatusChanged);

    return () => {
      socket.off('voice_rooms_list', handleRoomsList);
      socket.off('voice_room_updated', handleRoomUpdated);
      socket.off('voice_user_joined', handleUserJoined);
      socket.off('voice_user_left', handleUserLeft);
      socket.off('voice_room_closed', handleRoomClosed);
      socket.off('kick_from_voice', handleKicked);
      socket.off('voice_force_mute_received', handleForceMuteReceived);
      socket.off('voice_force_camera_off_received', handleForceCameraOffReceived);
      socket.off('voice_user_status_changed', handleUserStatusChanged);
      cleanupWebRTC();
    };
  }, [
    socket,
    currentUserId,
    cleanupWebRTC,
    initiateOfferToPeer,
    removePeerConnection,
    handleRemoteForceMute,
    handleRemoteForceCameraOff
  ]);

  // Create Room Handler
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || isCreating) return;

    setIsCreating(true);
    socket.emit(
      'create_voice_room',
      {
        name: newRoomName || `${currentUsername}'in Odası`,
        maxParticipants: newRoomCapacity
      },
      async (res: any) => {
        setIsCreating(false);
        if (res && res.success && res.room) {
          setCurrentRoom(res.room);
          setShowCreateModal(false);
          setNewRoomName('');
          await setupLocalMedia(true);
        } else {
          alert(res?.message || 'Oda oluşturulamadı.');
        }
      }
    );
  };

  // Join Room Handler with batched peer initiation
  const handleJoinRoom = async (roomId: string) => {
    if (!socket) return;
    await setupLocalMedia(true);

    socket.emit('join_voice_room', { roomId }, async (res: any) => {
      if (res && res.success && res.room) {
        setCurrentRoom(res.room);
        // Existing peers will receive voice_user_joined and initiate offers to this new participant
      } else {
        cleanupWebRTC();
        alert(res?.message || 'Odaya katılınamadı.');
      }
    });
  };

  // Leave Room Handler
  const handleLeaveRoom = () => {
    if (!socket) return;
    cleanupWebRTC();
    socket.emit('leave_voice_room');
    setCurrentRoom(null);
  };

  // Host Action: Kick
  const handleKickUser = (targetUserId: number) => {
    if (!socket || !currentRoom) return;
    if (confirm('Bu kullanıcıyı odadan atmak istediğinize emin misiniz?')) {
      socket.emit(
        'voice_kick_user',
        {
          roomId: currentRoom.id,
          targetUserId
        },
        (res: any) => {
          if (!res?.success) {
            alert(res?.message || 'Kullanıcı atılamadı.');
          }
        }
      );
    }
  };

  // Host Action: Force Mute
  const handleForceMuteUser = (targetUserId: number) => {
    if (!socket || !currentRoom) return;
    socket.emit(
      'voice_force_mute',
      {
        roomId: currentRoom.id,
        targetUserId
      },
      (res: any) => {
        if (!res?.success) {
          alert(res?.message || 'Kullanıcı susturulamadı.');
        }
      }
    );
  };

  // Host Action: Force Camera Off
  const handleForceCameraOffUser = (targetUserId: number) => {
    if (!socket || !currentRoom) return;
    socket.emit(
      'voice_force_camera_off',
      {
        roomId: currentRoom.id,
        targetUserId
      },
      (res: any) => {
        if (!res?.success) {
          alert(res?.message || 'Kamera kapatılamadı.');
        }
      }
    );
  };

  const filteredRooms = rooms.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.hostUsername.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isCurrentRoomHost = currentRoom?.hostId === currentUserId;

  return (
    <div className="flex-1 flex flex-col h-full w-full max-w-full bg-slate-950 text-slate-100 overflow-hidden select-none">
      
      {/* View 1: Active 20-Person Video / Voice Room */}
      {currentRoom ? (
        <VideoRoomView
          roomName={currentRoom.name}
          hostUsername={currentRoom.hostUsername}
          maxParticipants={currentRoom.maxParticipants}
          participants={currentRoom.participants}
          currentUserId={currentUserId}
          isHost={isCurrentRoomHost}
          localStream={localStream}
          remoteStreams={remoteStreams}
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          isDeafened={isDeafened}
          isSpeakingLocal={isSpeakingLocal}
          mediaPermissionError={mediaPermissionError}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          onToggleDeafen={toggleDeafen}
          onLeaveRoom={handleLeaveRoom}
          onKickUser={handleKickUser}
          onForceMuteUser={handleForceMuteUser}
          onForceCameraOffUser={handleForceCameraOffUser}
          onUserClick={onUserClick}
        />
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
                  Arkadaşlarınla 20 kişiye kadar yüksek kaliteli, düşük gecikmeli sesli ve kameralı odalara katıl veya yeni oda kur.
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

      {/* Create Room Modal with 20-Person Capacity Option */}
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
                    Maksimum Kişi Sayısı (Maks. {MAX_ROOM_USERS})
                  </label>
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 px-2.5 py-0.5 rounded-md">
                    {newRoomCapacity} Kişi
                  </span>
                </div>
                
                {/* 20-Person Capacity Range Buttons */}
                <div className="grid grid-cols-6 gap-1.5 pt-1">
                  {[2, 4, 8, 12, 16, 20].map((cap) => (
                    <button
                      key={cap}
                      type="button"
                      onClick={() => setNewRoomCapacity(cap)}
                      className={`min-h-[44px] rounded-xl text-xs font-bold transition-all ${
                        newRoomCapacity === cap
                          ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/40'
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
