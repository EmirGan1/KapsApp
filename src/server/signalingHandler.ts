import { Server, Socket } from 'socket.io';

export const MAX_ROOM_USERS = 20;

export interface VoiceParticipantData {
  id: number;
  username: string;
  avatar: string | null;
  color?: string;
  socketId: string;
  isHost: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
  isDeafened?: boolean;
  isVideoOff?: boolean;
  joinedAt: string;
}

export interface VoiceRoomData {
  id: string;
  name: string;
  hostId: number;
  hostUsername: string;
  maxParticipants: number;
  participants: Map<number, VoiceParticipantData>;
  createdAt: string;
}

export interface SignalingHelpers {
  emitVoiceRoomsList: () => void;
  broadcastVoiceRoom: (roomId: string) => void;
  getSanitizedVoiceRoom: (room: VoiceRoomData) => any;
}

/**
 * Registers optimized WebRTC signaling events on a socket connection.
 * Guarantees zero memory buffering on the server for SDP & ICE packets.
 */
export function registerSignalingHandlers(
  io: Server,
  socket: Socket,
  user: { id: number; username: string },
  voiceRooms: Map<string, VoiceRoomData>,
  helpers: SignalingHelpers
) {
  const { emitVoiceRoomsList, broadcastVoiceRoom } = helpers;

  // Direct tunnel for Offer
  socket.on('voice_offer', (data: { targetSocketId: string; offer: any }) => {
    if (data?.targetSocketId) {
      socket.to(data.targetSocketId).emit('voice_offer', {
        senderSocketId: socket.id,
        senderUserId: user.id,
        offer: data.offer
      });
    }
    if (data) data.offer = null;
  });

  // Direct tunnel for Answer
  socket.on('voice_answer', (data: { targetSocketId: string; answer: any }) => {
    if (data?.targetSocketId) {
      socket.to(data.targetSocketId).emit('voice_answer', {
        senderSocketId: socket.id,
        senderUserId: user.id,
        answer: data.answer
      });
    }
    if (data) data.answer = null;
  });

  // Direct tunnel for ICE Candidates
  socket.on('voice_ice_candidate', (data: { targetSocketId: string; candidate: any }) => {
    if (data?.targetSocketId) {
      socket.to(data.targetSocketId).emit('voice_ice_candidate', {
        senderSocketId: socket.id,
        senderUserId: user.id,
        candidate: data.candidate
      });
    }
    if (data) data.candidate = null;
  });

  // Clean disconnection & room exit logic
  const handleUserLeave = (roomId?: string) => {
    if (!roomId) return;
    socket.leave(`voice_${roomId}`);

    const room = voiceRooms.get(roomId);
    if (!room) return;

    if (room.hostId === user.id) {
      io.to(`voice_${roomId}`).emit('voice_room_closed', {
        reason: 'Oda kurucusu ayrıldığı için oda kapatıldı.'
      });
      voiceRooms.delete(roomId);
    } else {
      room.participants.delete(user.id);
      if (room.participants.size === 0) {
        voiceRooms.delete(roomId);
      } else {
        socket.to(`voice_${roomId}`).emit('voice_user_left', {
          userId: user.id,
          socketId: socket.id
        });
        broadcastVoiceRoom(roomId);
      }
    }
    emitVoiceRoomsList();
    socket.data.currentVoiceRoom = null;
  };

  return { handleUserLeave };
}
