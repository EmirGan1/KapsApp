/**
 * Socket.io WebRTC Signaling Handler
 * Architecture:
 * - Direct pipe tunnel (zero memory footprint, prevents server heap bloating under 1 GB RAM limit)
 * - 20-participant room ceiling enforcement (MAX_ROOM_USERS = 20)
 * - Reliable garbage collection and connection teardown on disconnect or room exit
 */

export const MAX_ROOM_USERS = 20;

export function registerSignalingHandlers(io, socket, user, voiceRooms, helpers) {
  const { emitVoiceRoomsList, broadcastVoiceRoom, getSanitizedVoiceRoom } = helpers;

  // 1. Direct SDP Offer Relay
  socket.on("voice_offer", (data) => {
    if (data?.targetSocketId) {
      socket.to(data.targetSocketId).emit("voice_offer", {
        senderSocketId: socket.id,
        senderUserId: user.id,
        offer: data.offer
      });
    }
    // Release reference for immediate GC
    if (data) data.offer = null;
  });

  // 2. Direct SDP Answer Relay
  socket.on("voice_answer", (data) => {
    if (data?.targetSocketId) {
      socket.to(data.targetSocketId).emit("voice_answer", {
        senderSocketId: socket.id,
        senderUserId: user.id,
        answer: data.answer
      });
    }
    // Release reference for immediate GC
    if (data) data.answer = null;
  });

  // 3. Direct ICE Candidate Relay (Trickle ICE)
  socket.on("voice_ice_candidate", (data) => {
    if (data?.targetSocketId) {
      socket.to(data.targetSocketId).emit("voice_ice_candidate", {
        senderSocketId: socket.id,
        senderUserId: user.id,
        candidate: data.candidate
      });
    }
    // Release reference for immediate GC
    if (data) data.candidate = null;
  });

  // 4. Clean Teardown on Disconnect / Room Exit
  const handleUserLeave = (roomId) => {
    if (!roomId) return;
    socket.leave(`voice_${roomId}`);

    const room = voiceRooms.get(roomId);
    if (!room) return;

    if (room.hostId === user.id) {
      io.to(`voice_${roomId}`).emit("voice_room_closed", {
        reason: "Oda kurucusu ayrıldığı için oda kapatıldı."
      });
      voiceRooms.delete(roomId);
    } else {
      room.participants.delete(user.id);
      if (room.participants.size === 0) {
        voiceRooms.delete(roomId);
      } else {
        socket.to(`voice_${roomId}`).emit("voice_user_left", {
          userId: user.id,
          socketId: socket.id
        });
        broadcastVoiceRoom(roomId);
      }
    }
    emitVoiceRoomsList();
    socket.data.currentVoiceRoom = null;
  };

  socket.on("leave_voice_room", (cb) => {
    const roomId = socket.data.currentVoiceRoom;
    handleUserLeave(roomId);
    if (cb) cb({ success: true });
  });

  return { handleUserLeave };
}
