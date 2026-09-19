import React, { useState, useEffect, useRef } from 'react';
import { 
  Gamepad2, Users, RefreshCcw, LogOut, Plus, Play, 
  ArrowDown, CheckCircle2, Trophy, Sparkles, Layers, 
  AlertCircle, ChevronRight, HelpCircle, Check, Crown
} from 'lucide-react';
import { Socket } from 'socket.io-client';
import Avatar from './Avatar';
import { 
  Tile, 
  OkeyRoomState, 
  autoSortRuns, 
  autoSortPairs, 
  checkClassicOkeyWin 
} from '../utils/okeyEngine';

const INITIAL_RACK_SIZE = 30; // 2 rows x 15 slots

export default function Games({ 
  socket, currentUserId, username, avatar, color 
}: { 
  socket: Socket | null; 
  currentUserId: number; 
  username: string; 
  avatar?: string | null; 
  color?: string | null; 
}) {
  const [rooms, setRooms] = useState<any[]>([]);
  const [currentRoom, setCurrentRoom] = useState<OkeyRoomState | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newRoomName, setNewRoomName] = useState('Klasik Okey Masası');

  // Rack & Selection state
  const [rack, setRack] = useState<(Tile | null)[]>(Array(INITIAL_RACK_SIZE).fill(null));
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [draggedSlot, setDraggedSlot] = useState<number | null>(null);
  const [isOverDiscardZone, setIsOverDiscardZone] = useState(false);
  const [touchDragState, setTouchDragState] = useState<{
    slotIndex: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    isDragging: boolean;
    tile: Tile;
  } | null>(null);
  const touchDragRef = useRef<{
    slotIndex: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    isDragging: boolean;
    tile: Tile;
  } | null>(null);

  // Messages / feedback
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Track double click timing
  const lastClickRef = useRef<{ slot: number; time: number }>({ slot: -1, time: 0 });

  // Socket communication
  useEffect(() => {
    if (!socket) return;

    // Refresh rooms and ask if user has an ongoing table
    socket.emit("get_okey_rooms");
    socket.emit("get_my_okey_room");

    const onRoomsList = (roomList: any[]) => setRooms(roomList);
    const onRoomCreated = (roomId: string) => {
      socket.emit("join_okey", roomId);
    };
    const onRoomState = (state: OkeyRoomState) => {
      setCurrentRoom(prev => {
        if (prev?.status === 'ended' && state.status === 'playing') {
          setSelectedSlot(null);
          setRack(Array(INITIAL_RACK_SIZE).fill(null));
        }
        return state;
      });
      if (state.lastActionMessage) {
        setInfoMessage(state.lastActionMessage);
      }
    };
    const onHand = (handTiles: Tile[]) => {
      // Synchronize rack with new private hand, preserving user arrangement
      setRack(prev => {
        const remainingTiles = [...handTiles];
        const newRack: (Tile | null)[] = Array(INITIAL_RACK_SIZE).fill(null);

        // Keep tiles that are still in hand in their existing slot positions
        prev.forEach((tile, idx) => {
          if (tile) {
            const foundIdx = remainingTiles.findIndex(t => t.id === tile.id);
            if (foundIdx !== -1) {
              newRack[idx] = remainingTiles[foundIdx];
              remainingTiles.splice(foundIdx, 1);
            }
          }
        });

        // Place remaining (e.g. newly drawn) tiles into the first empty slots
        let remIdx = 0;
        for (let i = 0; i < INITIAL_RACK_SIZE && remIdx < remainingTiles.length; i++) {
          if (newRack[i] === null) {
            newRack[i] = remainingTiles[remIdx++];
          }
        }
        return newRack;
      });
    };
    const onError = (msg: string) => {
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(null), 3500);
    };

    socket.on("okey_rooms_list", onRoomsList);
    socket.on("okey_room_created", onRoomCreated);
    socket.on("okey_state", onRoomState);
    socket.on("okey_hand", onHand);
    socket.on("okey_error", onError);

    return () => {
      socket.off("okey_rooms_list", onRoomsList);
      socket.off("okey_room_created", onRoomCreated);
      socket.off("okey_state", onRoomState);
      socket.off("okey_hand", onHand);
      socket.off("okey_error", onError);
    };
  }, [socket]);

  // Actions
  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim() || !socket) return;
    socket.emit("create_okey_room", { name: newRoomName.trim() });
    setIsCreating(false);
    setNewRoomName('Klasik Okey Masası');
  };

  const joinRoom = (roomId: string) => {
    if (!socket) return;
    socket.emit("join_okey", roomId);
  };

  const leaveRoom = () => {
    if (!socket) return;
    socket.emit("leave_okey");
    setCurrentRoom(null);
    setRack(Array(INITIAL_RACK_SIZE).fill(null));
    setSelectedSlot(null);
  };

  const startGame = () => {
    if (!socket || !currentRoom) return;
    setRack(Array(INITIAL_RACK_SIZE).fill(null));
    setSelectedSlot(null);
    socket.emit("start_okey_game", currentRoom.id);
  };

  // Turn checks
  const myPlayerIdx = currentRoom?.players.findIndex(p => p.id === currentUserId) ?? -1;
  const isMyTurn = currentRoom?.status === 'playing' && currentRoom.currentTurn === myPlayerIdx;
  const canDraw = isMyTurn && currentRoom?.turnPhase === 'draw';
  const canDiscard = isMyTurn && currentRoom?.turnPhase === 'discard';

  // Draw tile
  const handleDrawFromDeck = () => {
    if (!socket || !canDraw) return;
    socket.emit("okey_draw", { source: 'deck' });
  };

  const handleDrawFromDiscard = () => {
    if (!socket || !canDraw) return;
    socket.emit("okey_draw", { source: 'discard' });
  };

  // Discard tile
  const handleDiscard = (slotIndex: number) => {
    if (!socket || !canDiscard) return;
    const tile = rack[slotIndex];
    if (!tile) return;
    socket.emit("okey_discard", tile);
    setSelectedSlot(null);
  };

  // Rack Slot Click / Tap & Double-Click interaction
  const handleSlotClick = (index: number) => {
    const now = Date.now();
    const isDoubleClick = (
      lastClickRef.current.slot === index && 
      now - lastClickRef.current.time < 350
    );
    lastClickRef.current = { slot: index, time: now };

    // Double-click to instantly discard if canDiscard!
    if (isDoubleClick && canDiscard && rack[index] !== null) {
      handleDiscard(index);
      return;
    }

    // Single-click selection & swap
    if (selectedSlot === null) {
      if (rack[index] !== null) {
        setSelectedSlot(index);
      }
    } else {
      if (selectedSlot === index) {
        // Toggle selection off
        setSelectedSlot(null);
      } else {
        // Swap or move tile
        setRack(prev => {
          const next = [...prev];
          const temp = next[selectedSlot];
          next[selectedSlot] = next[index];
          next[index] = temp;
          return next;
        });
        setSelectedSlot(null);
      }
    }
  };

  // Drag and Drop (Mouse / Desktop)
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedSlot(index);
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnSlot = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedSlot === null || draggedSlot === targetIndex) return;
    setRack(prev => {
      const next = [...prev];
      const temp = next[draggedSlot];
      next[draggedSlot] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
    setDraggedSlot(null);
  };

  const handleDragOverDiscard = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isOverDiscardZone) setIsOverDiscardZone(true);
  };

  const handleDragLeaveDiscard = () => {
    setIsOverDiscardZone(false);
  };

  const handleDropOnDiscard = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOverDiscardZone(false);
    if (draggedSlot === null) return;
    if (canDiscard) {
      handleDiscard(draggedSlot);
    } else {
      setErrorMessage("Sıra sizde değil veya henüz taş çekmediniz.");
      setTimeout(() => setErrorMessage(null), 3000);
    }
    setDraggedSlot(null);
  };

  // Click on Discard Zone with a selected tile
  const handleClickDiscardZone = () => {
    if (selectedSlot !== null) {
      if (canDiscard) {
        handleDiscard(selectedSlot);
      } else {
        setErrorMessage("Sıra sizde değil veya henüz taş çekmediniz.");
        setTimeout(() => setErrorMessage(null), 3000);
      }
    }
  };

  // Touch Drag and Drop (Mobile / Tablet)
  const handleTouchStartSlot = (e: React.TouchEvent, index: number) => {
    const tile = rack[index];
    if (!tile) return;
    const touch = e.touches[0];
    const newTouch = {
      slotIndex: index,
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      isDragging: false,
      tile
    };
    touchDragRef.current = newTouch;
    setTouchDragState(newTouch);
  };

  const handleTouchMoveSlot = (e: React.TouchEvent) => {
    if (!touchDragRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchDragRef.current.startX;
    const dy = touch.clientY - touchDragRef.current.startY;
    const isDragging = touchDragRef.current.isDragging || Math.hypot(dx, dy) > 8;

    touchDragRef.current.currentX = touch.clientX;
    touchDragRef.current.currentY = touch.clientY;
    touchDragRef.current.isDragging = isDragging;

    if (isDragging) {
      if (e.cancelable) e.preventDefault();
      const elem = document.elementFromPoint(touch.clientX, touch.clientY);
      const isDrop = !!elem?.closest('[data-drop-zone="discard"]');
      setIsOverDiscardZone(isDrop);
    }
    setTouchDragState({ ...touchDragRef.current });
  };

  const handleTouchEndSlot = (e: React.TouchEvent) => {
    if (!touchDragRef.current) return;
    const { slotIndex, isDragging, currentX, currentY } = touchDragRef.current;

    if (isDragging) {
      const elem = document.elementFromPoint(currentX, currentY);
      const dropZone = elem?.closest('[data-drop-zone="discard"]');
      const targetSlotElem = elem?.closest('[data-slot-index]');

      if (dropZone) {
        if (canDiscard) {
          handleDiscard(slotIndex);
        } else {
          setErrorMessage("Sıra sizde değil veya henüz taş çekmediniz.");
          setTimeout(() => setErrorMessage(null), 3000);
        }
      } else if (targetSlotElem) {
        const targetIdx = Number(targetSlotElem.getAttribute('data-slot-index'));
        if (!isNaN(targetIdx) && targetIdx !== slotIndex) {
          setRack(prev => {
            const next = [...prev];
            const temp = next[slotIndex];
            next[slotIndex] = next[targetIdx];
            next[targetIdx] = temp;
            return next;
          });
        }
      }
    } else {
      // Tap selection or double-tap
      handleSlotClick(slotIndex);
    }

    touchDragRef.current = null;
    setTouchDragState(null);
    setIsOverDiscardZone(false);
  };

  // Auto Sort
  const handleSortRuns = () => {
    setRack(prev => autoSortRuns(prev));
    setSelectedSlot(null);
  };

  const handleSortPairs = () => {
    setRack(prev => autoSortPairs(prev));
    setSelectedSlot(null);
  };

  // Check if current rack tiles form a winning hand
  const currentHandTiles = rack.filter((t): t is Tile => t !== null);
  const selectedTile = selectedSlot !== null ? rack[selectedSlot] : null;
  const winCheckResult = currentRoom ? checkClassicOkeyWin(
    currentHandTiles, 
    currentRoom.okeyTile, 
    selectedTile ? selectedTile.id : undefined
  ) : { canWin: false };

  // Declare Win
  const handleDeclareWin = () => {
    if (!socket || !isMyTurn) {
      setErrorMessage("Yalnızca sıranız geldiğinde eli bitirebilirsiniz.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    if (!winCheckResult.canWin) {
      setErrorMessage(winCheckResult.reason || "Eliniz kurallara uygun bitmiyor. 14 taş per veya 7 çift olmalı.");
      setTimeout(() => setErrorMessage(null), 4000);
      return;
    }

    // Send declare win with candidate discard tile
    socket.emit("okey_declare_win", { discardTileId: winCheckResult.discardTileId });
  };

  // --- LOBBY VIEW ---
  if (!currentRoom) {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4 md:p-6 transition-colors">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Gamepad2 className="text-emerald-500" /> Klasik Okey Lobisi
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Geleneksel 4 kişilik Klasik Düz Okey masası kur veya mevcut masalara katıl!
              </p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => socket?.emit("get_okey_rooms")}
                className="p-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-colors"
                title="Yenile"
              >
                <RefreshCcw size={18} />
              </button>
              <button 
                onClick={() => setIsCreating(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl transition-colors shadow-sm flex items-center gap-2"
              >
                <Plus size={18} /> Masa Kur
              </button>
            </div>
          </div>

          {/* Create Room Modal */}
          {isCreating && (
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
              <h2 className="font-bold text-base md:text-lg mb-3 text-slate-800 dark:text-slate-200">Yeni Masa Oluştur</h2>
              <form onSubmit={handleCreateRoom} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-slate-400">Masa Adı</label>
                  <input 
                    type="text" 
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100"
                    placeholder="Klasik Okey Masası"
                  />
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/50 text-xs text-emerald-800 dark:text-emerald-300">
                  ℹ️ Masa modu: <strong>Klasik Düz Okey</strong> (106 taş, gösterge, okey taşı, 15/14 taş dağıtımı ve 14 taşlık per/çift bitirme kuralları).
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium">İptal</button>
                  <button type="submit" className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold">Oluştur ve Otur</button>
                </div>
              </form>
            </div>
          )}

          {/* Rooms Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {rooms.length === 0 ? (
              <div className="col-span-full py-16 text-center">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-400">
                  <Gamepad2 size={32} />
                </div>
                <p className="font-bold text-slate-700 dark:text-slate-300">Aktif masa bulunmuyor</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">İlk masayı kurup botlar veya arkadaşlarınla hemen başlayabilirsin!</p>
                <button 
                  onClick={() => setIsCreating(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl text-sm transition-colors inline-flex items-center gap-2"
                >
                  <Plus size={16} /> Hemen Masa Kur
                </button>
              </div>
            ) : (
              rooms.map((room) => (
                <div key={room.id} className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex justify-between items-center transition-all hover:border-emerald-500/50">
                  <div className="space-y-1">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base">{room.name}</h3>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                        <Users size={12}/> {room.players} / 4
                      </span>
                      <span className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 font-medium px-2 py-0.5 rounded-md">
                        Klasik Okey
                      </span>
                      <span className={`px-2 py-0.5 rounded-md font-medium ${room.status === 'playing' ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-500' : 'bg-blue-50 dark:bg-blue-950/50 text-blue-500'}`}>
                        {room.status === 'playing' ? 'Oyun Sürüyor' : 'Bekleniyor'}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => joinRoom(room.id)}
                    disabled={room.players >= 4 && room.status !== 'playing'}
                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
                      room.players >= 4 && room.status !== 'playing' 
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed' 
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                    }`}
                  >
                    Masaya Otur
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- OKEY TABLE VIEW ---
  const tablePlayers = currentRoom.players || [];
  
  // Arrange players relative to current user:
  // Me is Bottom.
  // Others: Left (Seat +3), Top (Seat +2), Right (Seat +1)
  let leftOpponent = null;
  let topOpponent = null;
  let rightOpponent = null;

  if (tablePlayers.length > 0) {
    if (myPlayerIdx !== -1) {
      rightOpponent = tablePlayers[(myPlayerIdx + 1) % tablePlayers.length] || null;
      topOpponent = tablePlayers.length >= 3 ? tablePlayers[(myPlayerIdx + 2) % tablePlayers.length] : null;
      leftOpponent = tablePlayers.length >= 4 ? tablePlayers[(myPlayerIdx + 3) % tablePlayers.length] : null;
    } else {
      leftOpponent = tablePlayers[0] || null;
      topOpponent = tablePlayers[1] || null;
      rightOpponent = tablePlayers[2] || null;
    }
  }

  const previousPlayer = myPlayerIdx !== -1 
    ? tablePlayers[(myPlayerIdx + tablePlayers.length - 1) % tablePlayers.length] 
    : null;
  const previousPlayerDiscard = previousPlayer?.discardPile && previousPlayer.discardPile.length > 0 
    ? previousPlayer.discardPile[previousPlayer.discardPile.length - 1] 
    : null;

  const myPlayer = myPlayerIdx !== -1 ? tablePlayers[myPlayerIdx] : null;
  const myDiscard = myPlayer?.discardPile && myPlayer.discardPile.length > 0 
    ? myPlayer.discardPile[myPlayer.discardPile.length - 1] 
    : null;

  const currentTurnPlayer = tablePlayers[currentRoom.currentTurn];

  // Determine host of the table
  const hostId = currentRoom.hostId ?? currentRoom.creatorId;
  const isHost = hostId === currentUserId;
  const hostPlayer = tablePlayers.find(p => p.id === hostId);

  return (
    <div 
      className="flex-1 flex flex-col bg-slate-950 text-slate-100 overflow-hidden relative selection:bg-transparent"
      style={{ touchAction: 'manipulation', overscrollBehavior: 'none' }}
    >
      
      {/* Toast Feedback */}
      {errorMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-red-600/95 text-white text-xs sm:text-sm font-medium px-4 py-2 rounded-xl shadow-xl flex items-center gap-2 backdrop-blur-md animate-bounce">
          <AlertCircle size={16} /> {errorMessage}
        </div>
      )}

      {/* Top Header Bar */}
      <div className="px-3 py-1.5 sm:py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0 z-20 backdrop-blur-md">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center shadow shrink-0">
            <Gamepad2 className="text-white w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h2 className="font-bold text-xs sm:text-sm text-emerald-400 truncate max-w-[120px] sm:max-w-[200px]">{currentRoom.name}</h2>
              <span className="text-[9px] sm:text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 px-1.5 py-0.2 rounded font-medium">
                Klasik Okey
              </span>
            </div>
            <p className="text-[10px] text-slate-400 flex items-center gap-1">
              <Users size={10} /> {tablePlayers.length}/4 Oyuncu {currentRoom.status === 'playing' ? '• Canlı Oyun' : '• Bekleniyor'}
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          {currentRoom.status === 'waiting' && (
            isHost ? (
              <button 
                onClick={startGame}
                className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg ring-2 sm:ring-4 ring-emerald-400/50 transition-all animate-pulse active:scale-95 cursor-pointer"
                title="Taşları dağıt ve oyunu başlat"
              >
                <Play size={14} fill="currentColor" /> Taşları Dağıt
              </button>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-amber-950/70 border border-amber-800/60 text-amber-300 rounded-lg text-[11px] font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                <span>Host bekleniyor ({hostPlayer?.username || 'Host'})</span>
              </div>
            )
          )}

          <button 
            onClick={leaveRoom}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-red-900/40 text-slate-300 hover:text-red-300 rounded-lg text-xs font-medium transition-colors"
            title="Masadan Ayrıl"
          >
            <LogOut size={14} /> <span className="hidden sm:inline">Ayrıl</span>
          </button>
        </div>
      </div>

      {/* Opponents Dashboard Bar (Top) - Compact, Scaled for Mobile & Tablet */}
      <div className="bg-slate-900/70 border-b border-slate-800 px-2 py-1.5 flex items-center justify-around gap-1 shrink-0 z-10">
        
        {/* Left Opponent */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-xl transition-all ${
          currentTurnPlayer?.id === leftOpponent?.id 
            ? 'ring-2 ring-emerald-400 bg-emerald-950/60 shadow-lg' 
            : 'opacity-80 bg-slate-800/40'
        }`}>
          {leftOpponent ? (
            <>
              <div className="relative">
                <Avatar url={leftOpponent.avatar || undefined} name={leftOpponent.username} color={leftOpponent.color || undefined} size={6} />
                {currentTurnPlayer?.id === leftOpponent.id && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border border-slate-900 animate-ping"></span>
                )}
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold text-slate-200 leading-tight max-w-[70px] sm:max-w-[100px] truncate flex items-center gap-0.5">
                  {leftOpponent.username}
                  {leftOpponent.id === hostId && (
                    <span title="Masa Yöneticisi (Host)">
                      <Crown size={10} className="text-amber-400 shrink-0 inline" />
                    </span>
                  )}
                </p>
                <span className="text-[9px] text-slate-400 flex items-center gap-0.5">
                  🀄 {leftOpponent.tileCount} taş
                  {currentTurnPlayer?.id === leftOpponent.id && (
                    <span className="text-emerald-400 font-bold ml-1 animate-pulse">Sırada</span>
                  )}
                </span>
              </div>
            </>
          ) : (
            <div className="text-[10px] text-slate-500 py-1 px-2 border border-dashed border-slate-700 rounded-md">Boş Koltuk</div>
          )}
        </div>

        {/* Top Opponent */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-xl transition-all ${
          currentTurnPlayer?.id === topOpponent?.id 
            ? 'ring-2 ring-emerald-400 bg-emerald-950/60 shadow-lg' 
            : 'opacity-80 bg-slate-800/40'
        }`}>
          {topOpponent ? (
            <>
              <div className="relative">
                <Avatar url={topOpponent.avatar || undefined} name={topOpponent.username} color={topOpponent.color || undefined} size={6} />
                {currentTurnPlayer?.id === topOpponent.id && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border border-slate-900 animate-ping"></span>
                )}
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold text-slate-200 leading-tight max-w-[70px] sm:max-w-[100px] truncate flex items-center gap-0.5">
                  {topOpponent.username}
                  {topOpponent.id === hostId && (
                    <span title="Masa Yöneticisi (Host)">
                      <Crown size={10} className="text-amber-400 shrink-0 inline" />
                    </span>
                  )}
                </p>
                <span className="text-[9px] text-slate-400 flex items-center gap-0.5">
                  🀄 {topOpponent.tileCount} taş
                  {currentTurnPlayer?.id === topOpponent.id && (
                    <span className="text-emerald-400 font-bold ml-1 animate-pulse">Sırada</span>
                  )}
                </span>
              </div>
            </>
          ) : (
            <div className="text-[10px] text-slate-500 py-1 px-2 border border-dashed border-slate-700 rounded-md">Boş Koltuk</div>
          )}
        </div>

        {/* Right Opponent */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-xl transition-all ${
          currentTurnPlayer?.id === rightOpponent?.id 
            ? 'ring-2 ring-emerald-400 bg-emerald-950/60 shadow-lg' 
            : 'opacity-80 bg-slate-800/40'
        }`}>
          {rightOpponent ? (
            <>
              <div className="relative">
                <Avatar url={rightOpponent.avatar || undefined} name={rightOpponent.username} color={rightOpponent.color || undefined} size={6} />
                {currentTurnPlayer?.id === rightOpponent.id && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border border-slate-900 animate-ping"></span>
                )}
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold text-slate-200 leading-tight max-w-[70px] sm:max-w-[100px] truncate flex items-center gap-0.5">
                  {rightOpponent.username}
                  {rightOpponent.id === hostId && (
                    <span title="Masa Yöneticisi (Host)">
                      <Crown size={10} className="text-amber-400 shrink-0 inline" />
                    </span>
                  )}
                </p>
                <span className="text-[9px] text-slate-400 flex items-center gap-0.5">
                  🀄 {rightOpponent.tileCount} taş
                  {currentTurnPlayer?.id === rightOpponent.id && (
                    <span className="text-emerald-400 font-bold ml-1 animate-pulse">Sırada</span>
                  )}
                </span>
              </div>
            </>
          ) : (
            <div className="text-[10px] text-slate-500 py-1 px-2 border border-dashed border-slate-700 rounded-md">Boş Koltuk</div>
          )}
        </div>
      </div>

      {/* Main Board Surface (Green Felt Area) - Sized cleanly for Tablet & Mobile */}
      <div 
        className="flex-1 relative flex flex-col justify-between p-2 sm:p-3 overflow-hidden bg-[radial-gradient(ellipse_at_center,#134e34_0%,#09261a_70%,#03120b_100%)] border-y border-emerald-950/40 shadow-inner"
        style={{ overscrollBehavior: 'none' }}
      >
        
        {/* Live Action Ticker Banner - Highly Clear & Actionable */}
        <div className="w-full flex justify-center z-10">
          <div className={`backdrop-blur-md px-3 sm:px-4 py-1.5 rounded-full border shadow-lg flex items-center gap-2 max-w-lg transition-all ${
            isMyTurn 
              ? canDraw 
                ? 'bg-emerald-900/90 border-emerald-400 text-emerald-100 ring-2 ring-emerald-400/40' 
                : 'bg-amber-900/90 border-amber-400 text-amber-100 ring-2 ring-amber-400/40'
              : 'bg-slate-900/80 border-slate-700/60 text-slate-300'
          }`}>
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              isMyTurn ? (canDraw ? 'bg-emerald-400 animate-ping' : 'bg-amber-400 animate-ping') : 'bg-slate-400'
            }`}></span>
            <span className="text-xs sm:text-sm font-semibold truncate">
              {currentRoom.status === 'playing' ? (
                isMyTurn ? (
                  canDraw 
                    ? "🎯 Sıra Sende! Ortadaki desteden veya yandan taş çek." 
                    : "🎯 Sıra Sende! Istakandan bir taş seçip 'Taşı At'a bas veya taşa çift tıkla."
                ) : (
                  currentRoom.turnPhase === 'draw'
                    ? `⏳ ${currentTurnPlayer?.username || 'Oyuncu'} taş çekiyor...`
                    : `⏳ ${currentTurnPlayer?.username || 'Oyuncu'} taş atıyor...`
                )
              ) : (
                isHost 
                  ? "👑 Masa Yöneticisisiniz. Hazır olduğunuzda 'Taşları Dağıt' butonuna basın." 
                  : `⏳ Masa Yöneticisinin (${hostPlayer?.username || 'Host'}) taşları dağıtması bekleniyor...`
              )}
            </span>
          </div>
        </div>

        {/* Center Playing Surface & Discard Stations */}
        <div className="my-auto w-full max-w-4xl mx-auto px-2 sm:px-4 z-10 select-none">
          {currentRoom.status === 'waiting' ? (
            <div className="flex items-center justify-center py-4">
              {isHost ? (
                <div className="bg-slate-900/95 border-2 border-emerald-500/60 shadow-2xl p-4 sm:p-6 rounded-2xl text-center max-w-sm w-full backdrop-blur-md animate-in fade-in zoom-in">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3">
                    <Crown size={28} />
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white">Masa Yöneticisisiniz</h3>
                  <p className="text-xs text-slate-300 mt-1 mb-4">
                    Masa kuruldu ({tablePlayers.length}/4 oyuncu). Hazır olduğunuzda taşları dağıtıp oyunu başlatabilirsiniz!
                  </p>
                  <button
                    onClick={startGame}
                    className="w-full py-3 px-6 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-sm rounded-xl shadow-xl ring-4 ring-emerald-400/50 animate-pulse flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
                  >
                    <Play size={18} fill="currentColor" /> Taşları Dağıt (Oyunu Başlat)
                  </button>
                </div>
              ) : (
                <div className="bg-slate-900/90 border border-amber-500/40 shadow-2xl p-4 sm:p-6 rounded-2xl text-center max-w-sm w-full backdrop-blur-md animate-in fade-in zoom-in">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-3 animate-spin">
                    <RefreshCcw size={26} />
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white">Masa Yöneticisi Bekleniyor</h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Masa yöneticisi <strong className="text-amber-300">{hostPlayer?.username || 'Host'}</strong> taşları dağıttığında oyun başlayacak.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full flex items-center justify-between gap-2 sm:gap-6 py-2">
              
              {/* 1. SOL ISKARTASI: Önceki Oyuncunun Attığı Taşlar (Çekilebilen Alan) */}
              <div className="flex flex-col items-center shrink-0">
                <span className="text-[10px] sm:text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-400 inline-block"></span>
                  <span>Sol Iskartası</span>
                </span>
                
                <button
                  onClick={handleDrawFromDiscard}
                  disabled={!canDraw || !previousPlayerDiscard}
                  className={`relative p-1 rounded-xl transition-all flex flex-col items-center justify-center ${
                    canDraw && previousPlayerDiscard
                      ? 'ring-4 ring-blue-400 hover:scale-105 cursor-pointer animate-pulse bg-blue-950/60 shadow-2xl'
                      : 'cursor-default opacity-85'
                  }`}
                  title={canDraw && previousPlayerDiscard ? "Soldaki Oyuncunun Attığı Taşı Çek" : "Sol Iskartası"}
                >
                  {previousPlayerDiscard ? (
                    <div className="relative">
                      <TileView tile={previousPlayerDiscard} size="md" />
                      <span className={`absolute -top-3 left-1/2 -translate-x-1/2 text-[8px] xs:text-[9px] sm:text-[10px] font-extrabold px-1.5 sm:px-2 py-0.5 rounded-full shadow-lg whitespace-nowrap ${
                        canDraw ? 'bg-blue-600 text-white animate-bounce' : 'bg-slate-800 text-slate-300'
                      }`}>
                        {canDraw ? 'Soldan Çek' : 'Atılan Taş'}
                      </span>
                    </div>
                  ) : (
                    <div className="w-9 h-13 xs:w-10 xs:h-15 sm:w-12 sm:h-18 bg-slate-900/60 rounded-lg border-2 border-dashed border-slate-700/80 flex flex-col items-center justify-center text-[9px] sm:text-[10px] text-slate-500">
                      <span>Boş</span>
                    </div>
                  )}
                </button>
                <span className="text-[8px] xs:text-[9px] sm:text-[10px] text-slate-400 mt-0.5 sm:mt-1 max-w-[65px] sm:max-w-[100px] truncate text-center">
                  {previousPlayer ? previousPlayer.username : 'Önceki Oyuncu'}
                </span>
              </div>

              {/* 2. ORTA ALAN: Yalnızca Kapalı Deste ve Gösterge (ve Okey Rozeti) */}
              <div className="flex flex-col items-center justify-center shrink-0">
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-1.5 sm:p-3 shadow-2xl flex items-center gap-1.5 xs:gap-2.5 sm:gap-6 backdrop-blur-sm">
                  
                  {/* Kapalı Deste */}
                  <div className="flex flex-col items-center gap-1">
                    <button 
                      onClick={handleDrawFromDeck}
                      disabled={!canDraw}
                      className={`relative w-9 h-13 xs:w-10 xs:h-15 sm:w-12 sm:h-18 bg-[#fefae0] rounded-lg shadow-xl border-2 transition-all flex flex-col items-center justify-center ${
                        canDraw 
                          ? 'ring-4 ring-emerald-400 hover:scale-105 border-emerald-500 cursor-pointer animate-pulse' 
                          : 'border-slate-300 opacity-90 cursor-default'
                      }`}
                      title={canDraw ? "Ortadan Kapalı Taş Çek" : "Kapalı Deste"}
                    >
                      <div className="w-4 h-4 xs:w-5 xs:h-5 sm:w-6 sm:h-6 rounded-full border-2 border-red-700/70 flex items-center justify-center">
                        <span className="text-[7px] xs:text-[8px] sm:text-[9px] font-black text-red-700">OKEY</span>
                      </div>
                      <span className="text-[10px] xs:text-[11px] sm:text-xs font-black text-slate-900 mt-0.5">
                        {currentRoom.deckCount}
                      </span>
                      <span className={`absolute -top-2.5 px-1.5 sm:px-2 py-0.5 rounded-full text-[8px] xs:text-[9px] sm:text-[10px] font-extrabold shadow-lg whitespace-nowrap ${
                        canDraw ? 'bg-emerald-600 text-white animate-bounce' : 'bg-slate-900 text-white'
                      }`}>
                        {canDraw ? 'Desteden Çek' : 'Deste'}
                      </span>
                    </button>
                  </div>

                  {/* Gösterge Taşı */}
                  <div className="flex flex-col items-center gap-1">
                    {currentRoom.indicator ? (
                      <div className="relative">
                        <TileView tile={currentRoom.indicator} size="md" />
                        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-600 text-white text-[8px] xs:text-[9px] sm:text-[10px] font-extrabold px-1.5 sm:px-2 py-0.5 rounded-full shadow-lg whitespace-nowrap">
                          Gösterge
                        </span>
                      </div>
                    ) : (
                      <div className="w-9 h-13 xs:w-10 xs:h-15 sm:w-12 sm:h-18 bg-slate-900/60 rounded-lg border border-dashed border-slate-700 flex items-center justify-center text-[10px] text-slate-500">
                        Yok
                      </div>
                    )}
                  </div>

                  {/* Okey Rozeti */}
                  {currentRoom.okeyTile && (
                    <div className="flex flex-col items-center gap-1">
                      <div className="relative">
                        <TileView tile={currentRoom.okeyTile} size="md" isOkeyBadge />
                        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[8px] xs:text-[9px] sm:text-[10px] font-extrabold px-1.5 sm:px-2 py-0.5 rounded-full shadow-lg flex items-center gap-0.5 whitespace-nowrap">
                          <Sparkles size={9} /> OKEY
                        </span>
                      </div>
                    </div>
                  )}

                </div>
              </div>

              {/* 3. SAĞ ISKARTASI: Kendi Atacağı Taşlar (Sürükle Bırak / Tıkla Bırak Alanı) */}
              <div className="flex flex-col items-center shrink-0">
                <span className="text-[10px] sm:text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                  <span>Sağ Iskartası</span>
                </span>
                
                <div 
                  data-drop-zone="discard"
                  onDragOver={handleDragOverDiscard}
                  onDragLeave={handleDragLeaveDiscard}
                  onDrop={handleDropOnDiscard}
                  onClick={handleClickDiscardZone}
                  className={`relative w-9 h-13 xs:w-10 xs:h-15 sm:w-12 sm:h-18 rounded-xl border-2 transition-all flex flex-col items-center justify-center p-0.5 sm:p-1 ${
                    canDiscard
                      ? isOverDiscardZone
                        ? 'border-emerald-400 ring-4 ring-emerald-400 bg-emerald-950/80 scale-105 shadow-2xl cursor-pointer'
                        : 'border-amber-400 border-dashed ring-2 ring-amber-400/50 bg-amber-950/30 shadow-lg cursor-pointer animate-pulse'
                      : 'border-slate-700/70 bg-slate-900/60 cursor-default'
                  }`}
                  title={canDiscard ? "Taşı Buraya Sürükleyip Bırakın veya Seçip Tıklayın" : "Kendi Iskartanız"}
                >
                  {myDiscard ? (
                    <div className="relative">
                      <TileView tile={myDiscard} size="md" />
                      <span className={`absolute -top-3 left-1/2 -translate-x-1/2 text-[8px] xs:text-[9px] sm:text-[10px] font-extrabold px-1.5 sm:px-2 py-0.5 rounded-full shadow-lg whitespace-nowrap ${
                        canDiscard ? 'bg-amber-500 text-slate-950 animate-bounce' : 'bg-slate-800 text-slate-300'
                      }`}>
                        {canDiscard ? 'Buraya At' : 'Son Attığın'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-0.5">
                      <ArrowDown size={16} className={canDiscard ? 'text-amber-400 animate-bounce' : 'text-slate-500'} />
                      <span className={`text-[8px] xs:text-[9px] font-bold leading-tight mt-0.5 ${canDiscard ? 'text-amber-300' : 'text-slate-500'}`}>
                        {canDiscard ? 'Taşı At' : 'Iskarta'}
                      </span>
                    </div>
                  )}

                  {canDiscard && (
                    <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[7px] xs:text-[8px] sm:text-[9px] font-extrabold px-1.5 py-0.2 rounded-full shadow whitespace-nowrap">
                      Taş Atma
                    </span>
                  )}
                </div>
                <span className="text-[8px] xs:text-[9px] sm:text-[10px] text-slate-400 mt-0.5 sm:mt-1 max-w-[65px] sm:max-w-[100px] truncate text-center">
                  Senin Iskartan
                </span>
              </div>

            </div>
          )}

          {/* Game End Modal / Banner */}
          {currentRoom.status === 'ended' && (
            <div className="bg-slate-900/95 p-4 sm:p-5 rounded-2xl border-2 border-emerald-500 shadow-2xl text-center max-w-sm w-full mx-auto mt-2 animate-in fade-in zoom-in">
              <Trophy className="text-amber-400 w-12 h-12 mx-auto mb-2 animate-bounce" />
              <h3 className="text-lg font-black text-white">Tebrikler!</h3>
              <p className="text-xs text-slate-300 mt-1 mb-3">{currentRoom.winningReason}</p>
              {isHost ? (
                <button 
                  onClick={startGame}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow transition-colors animate-pulse cursor-pointer"
                >
                  Taşları Tekrar Dağıt
                </button>
              ) : (
                <p className="text-xs text-amber-300">Masa yöneticisinin yeni eli başlatması bekleniyor...</p>
              )}
            </div>
          )}
        </div>

        {/* Player Action Buttons Toolbar */}
        <div className="w-full max-w-3xl mx-auto flex items-center justify-between gap-1 sm:gap-2 px-1 z-10">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button 
              onClick={handleSortRuns}
              className="px-2.5 sm:px-3 py-1 bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-[11px] sm:text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 border border-slate-700 shadow"
              title="Taşları renklere ve sayılara göre serilere diz"
            >
              <Layers size={13} className="text-emerald-400" /> Seri
            </button>
            <button 
              onClick={handleSortPairs}
              className="px-2.5 sm:px-3 py-1 bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-[11px] sm:text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 border border-slate-700 shadow"
              title="Aynı taşları yan yana çiftlere diz"
            >
              <CheckCircle2 size={13} className="text-blue-400" /> Çift
            </button>

            {/* Selected Tile indicator & Fast Discard Action */}
            {selectedSlot !== null && rack[selectedSlot] && (
              <div className="flex items-center gap-1 bg-amber-950/80 border border-amber-500/60 rounded-lg px-2 py-0.5 animate-in fade-in">
                <span className="text-[10px] text-amber-200 font-bold hidden xs:inline">
                  Seçili: Hedef göze dokun
                </span>
                {canDiscard && (
                  <button
                    onClick={() => handleDiscard(selectedSlot)}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] sm:text-[11px] px-2 py-0.5 rounded shadow flex items-center gap-0.5 animate-pulse"
                    title="Seçili taşı sağ ıskartaya at"
                  >
                    <ArrowDown size={12} /> Taşı At
                  </button>
                )}
                <button
                  onClick={() => setSelectedSlot(null)}
                  className="text-amber-400 hover:text-white text-[10px] px-1"
                  title="Seçimi kaldır"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Bitti Button */}
            {currentRoom.status === 'playing' && (
              <button 
                onClick={handleDeclareWin}
                disabled={!isMyTurn}
                className={`px-3 sm:px-4 py-1 text-[11px] sm:text-xs font-bold rounded-lg shadow flex items-center gap-1 transition-all ${
                  isMyTurn 
                    ? winCheckResult.canWin
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 ring-2 ring-yellow-300 animate-bounce cursor-pointer'
                      : 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
                title="14 taş per veya 7 çift olduğunda eli bitir"
              >
                <Crown size={14} className={winCheckResult.canWin ? 'text-amber-900' : 'text-amber-300'} />
                Eli Bitir (Bitti!)
              </button>
            )}
          </div>
        </div>

        {/* The Istaka (Player Rack) - 2 rows x 15 slots, Tablet & Mobile Scaled */}
        <div 
          className="w-full max-w-4xl mx-auto z-10 origin-bottom pt-1 px-0.5 sm:px-1 select-none"
          style={{ touchAction: 'none', overscrollBehavior: 'none' }}
        >
          <div className="bg-gradient-to-b from-[#7a3e14] via-[#5c2b09] to-[#381a04] p-1 sm:p-2 rounded-t-xl sm:rounded-t-2xl border-t-2 border-amber-600/80 shadow-2xl relative">
            
            {/* Top Row of Istaka */}
            <div className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-0.5 sm:gap-1 pb-1 border-b border-[#381a04]">
              {rack.slice(0, 15).map((tile, idx) => (
                <RackSlot 
                  key={idx}
                  slotIndex={idx}
                  tile={tile}
                  isSelected={selectedSlot === idx}
                  isTouchDragging={touchDragState?.slotIndex === idx && touchDragState.isDragging}
                  onClick={() => handleSlotClick(idx)}
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDropOnSlot(e, idx)}
                  onTouchStart={(e) => handleTouchStartSlot(e, idx)}
                  onTouchMove={handleTouchMoveSlot}
                  onTouchEnd={handleTouchEndSlot}
                />
              ))}
            </div>

            {/* Bottom Row of Istaka */}
            <div className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-0.5 sm:gap-1 pt-1">
              {rack.slice(15, 30).map((tile, idx) => {
                const realIdx = idx + 15;
                return (
                  <RackSlot 
                    key={realIdx}
                    slotIndex={realIdx}
                    tile={tile}
                    isSelected={selectedSlot === realIdx}
                    isTouchDragging={touchDragState?.slotIndex === realIdx && touchDragState.isDragging}
                    onClick={() => handleSlotClick(realIdx)}
                    onDragStart={(e) => handleDragStart(e, realIdx)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropOnSlot(e, realIdx)}
                    onTouchStart={(e) => handleTouchStartSlot(e, realIdx)}
                    onTouchMove={handleTouchMoveSlot}
                    onTouchEnd={handleTouchEndSlot}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Touch Drag Floating Preview */}
        {touchDragState?.isDragging && touchDragState.tile && (
          <div 
            className="fixed pointer-events-none z-50 transform -translate-x-1/2 -translate-y-1/2 shadow-2xl scale-110 opacity-95"
            style={{
              left: `${touchDragState.currentX}px`,
              top: `${touchDragState.currentY}px`
            }}
          >
            <TileView tile={touchDragState.tile} size="md" />
          </div>
        )}

      </div>
    </div>
  );
}

// Subcomponents: Single Rack Slot with Mouse & Touch support
function RackSlot({ 
  slotIndex, 
  tile, 
  isSelected, 
  isTouchDragging,
  onClick, 
  onDragStart, 
  onDragOver, 
  onDrop,
  onTouchStart,
  onTouchMove,
  onTouchEnd
}: { 
  slotIndex: number; 
  tile: Tile | null; 
  isSelected: boolean; 
  isTouchDragging?: boolean;
  onClick: () => void; 
  onDragStart: (e: React.DragEvent) => void; 
  onDragOver: (e: React.DragEvent) => void; 
  onDrop: (e: React.DragEvent) => void; 
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}) {
  return (
    <div 
      data-slot-index={slotIndex}
      onClick={onClick}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className={`aspect-[2/3] w-full min-w-0 max-w-[48px] bg-[#3a1a03]/90 rounded-[2px] xs:rounded-[3px] sm:rounded-[5px] border border-[#2b1201] flex items-center justify-center relative shadow-inner cursor-pointer transition-all select-none touch-none ${
        isSelected 
          ? 'ring-2 sm:ring-3 ring-emerald-400 -translate-y-1 sm:-translate-y-2 z-20 shadow-xl bg-[#4a2204]' 
          : isTouchDragging
            ? 'opacity-30 scale-90'
            : 'active:scale-95'
      }`}
    >
      {tile && (
        <TileView 
          tile={tile} 
          size="rack" 
          draggable 
          onDragStart={onDragStart} 
        />
      )}
    </div>
  );
}

// Subcomponent: High Quality Okey Tile Display
function TileView({ 
  tile, 
  size = 'rack',
  draggable = false, 
  onDragStart,
  isOkeyBadge = false
}: { 
  tile: Tile; 
  size?: 'sm' | 'md' | 'rack'; 
  draggable?: boolean; 
  onDragStart?: (e: React.DragEvent) => void; 
  isOkeyBadge?: boolean;
}) {
  const colorTextMap: Record<string, string> = {
    red: 'text-red-600',
    blue: 'text-blue-600',
    black: 'text-slate-950',
    yellow: 'text-amber-500',
    fake: 'text-slate-800'
  };

  const colorBgMap: Record<string, string> = {
    red: 'bg-red-600',
    blue: 'bg-blue-600',
    black: 'bg-slate-950',
    yellow: 'bg-amber-500',
    fake: 'bg-slate-800'
  };

  // Sizing styles
  const sizeClasses = {
    sm: 'w-7 h-10 xs:w-8 xs:h-12 text-xs rounded-[3px]',
    md: 'w-9 h-13 xs:w-10 xs:h-15 sm:w-12 sm:h-18 text-xs xs:text-sm sm:text-base md:text-lg rounded-[4px] sm:rounded-md',
    rack: 'w-full h-full text-[9px] xs:text-[11px] sm:text-sm md:text-base rounded-[2px] sm:rounded-sm'
  }[size];

  if (tile.color === 'fake') {
    return (
      <div 
        draggable={draggable}
        onDragStart={onDragStart}
        className={`${sizeClasses} bg-[#fefae0] border border-slate-300 shadow flex flex-col items-center justify-center relative cursor-grab active:cursor-grabbing font-black`}
      >
        <div className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 rounded-full border-2 border-slate-900 flex items-center justify-center">
          <div className="w-1 h-1 bg-slate-900 rounded-full"></div>
        </div>
        <span className="text-[7px] sm:text-[8px] text-slate-600 font-bold mt-0.5">Sahte</span>
      </div>
    );
  }

  return (
    <div 
      draggable={draggable}
      onDragStart={onDragStart}
      className={`${sizeClasses} bg-[#fefae0] border border-slate-300 shadow flex flex-col items-center justify-center relative cursor-grab active:cursor-grabbing font-black leading-none select-none ${colorTextMap[tile.color] || 'text-slate-900'}`}
    >
      <span className="mt-0.5">{tile.number}</span>
      <div className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full mt-0.5 sm:mt-1 ${colorBgMap[tile.color] || 'bg-slate-900'}`}></div>
      {tile.isOkey && (
        <span className="absolute -top-1 -right-1 text-[8px] sm:text-[10px]" title="Okey Taşı">
          ⭐
        </span>
      )}
    </div>
  );
}
