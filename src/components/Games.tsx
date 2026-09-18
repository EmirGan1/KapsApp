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
      setCurrentRoom(state);
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

  const currentTurnPlayer = tablePlayers[currentRoom.currentTurn];

  return (
    <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 overflow-hidden relative selection:bg-transparent">
      
      {/* Toast Feedback */}
      {errorMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-red-600/95 text-white text-xs sm:text-sm font-medium px-4 py-2 rounded-xl shadow-xl flex items-center gap-2 backdrop-blur-md animate-bounce">
          <AlertCircle size={16} /> {errorMessage}
        </div>
      )}

      {/* Top Header Bar */}
      <div className="px-3 py-1.5 sm:py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0 z-20 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center shadow">
            <Gamepad2 className="text-white w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-xs sm:text-sm text-emerald-400">{currentRoom.name}</h2>
              <span className="text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 px-1.5 py-0.5 rounded font-medium">
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
            <button 
              onClick={startGame}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-md transition-colors animate-pulse"
            >
              <Play size={14} fill="currentColor" /> Başlat (Botlarla Doldur)
            </button>
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
                <p className="text-[10px] font-bold text-slate-200 leading-tight max-w-[70px] sm:max-w-[100px] truncate">
                  {leftOpponent.username}
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
                <p className="text-[10px] font-bold text-slate-200 leading-tight max-w-[70px] sm:max-w-[100px] truncate">
                  {topOpponent.username}
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
                <p className="text-[10px] font-bold text-slate-200 leading-tight max-w-[70px] sm:max-w-[100px] truncate">
                  {rightOpponent.username}
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
      <div className="flex-1 relative flex flex-col justify-between p-2 sm:p-3 overflow-hidden bg-[radial-gradient(ellipse_at_center,#134e34_0%,#09261a_70%,#03120b_100%)] border-y border-emerald-950/40 shadow-inner">
        
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
                "Oyunun başlaması için yukarıdaki 'Başlat' butonuna basın."
              )}
            </span>
          </div>
        </div>

        {/* Center Board Station: Deck, Indicator, Okey Badge, Discards */}
        <div className="my-auto flex flex-col items-center justify-center gap-3 w-full max-w-2xl mx-auto z-10">
          
          {/* Deck, Indicator, and Neighbor Discard Row */}
          <div className="flex items-center justify-center gap-3 sm:gap-6 flex-wrap">
            
            {/* Draw Deck (Kapalı Deste) */}
            <div className="flex flex-col items-center gap-1">
              <button 
                onClick={handleDrawFromDeck}
                disabled={!canDraw}
                className={`relative w-11 h-16 sm:w-13 sm:h-18 bg-[#fefae0] rounded-lg shadow-xl border-2 transition-all flex flex-col items-center justify-center ${
                  canDraw 
                    ? 'ring-4 ring-emerald-400 hover:scale-105 border-emerald-500 cursor-pointer animate-pulse' 
                    : 'border-slate-300 opacity-90 cursor-default'
                }`}
                title={canDraw ? "Ortadan Taş Çek" : "Kapalı Deste"}
              >
                <div className="w-6 h-6 rounded-full border-2 border-red-700/70 flex items-center justify-center">
                  <span className="text-[9px] font-black text-red-700">OKEY</span>
                </div>
                <span className="text-[11px] font-extrabold text-slate-800 mt-1">
                  {currentRoom.deckCount}
                </span>
                <span className={`absolute -top-2.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold shadow ${
                  canDraw ? 'bg-emerald-600 text-white animate-bounce' : 'bg-slate-900 text-white'
                }`}>
                  {canDraw ? 'Taş Çek' : 'Deste'}
                </span>
              </button>
            </div>

            {/* Indicator Tile (Gösterge) */}
            <div className="flex flex-col items-center gap-1">
              {currentRoom.indicator ? (
                <div className="relative">
                  <TileView tile={currentRoom.indicator} size="md" />
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-600 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full shadow whitespace-nowrap">
                    Gösterge
                  </span>
                </div>
              ) : (
                <div className="w-11 h-16 sm:w-13 sm:h-18 bg-slate-800/40 rounded-lg border border-dashed border-slate-600 flex items-center justify-center text-[10px] text-slate-500">
                  Yok
                </div>
              )}
            </div>

            {/* Okey Tile Indicator Badge */}
            {currentRoom.okeyTile && (
              <div className="flex flex-col items-center gap-1">
                <div className="relative">
                  <TileView tile={currentRoom.okeyTile} size="md" isOkeyBadge />
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full shadow flex items-center gap-0.5 whitespace-nowrap">
                    <Sparkles size={10} /> OKEY
                  </span>
                </div>
              </div>
            )}

            {/* Right Neighbor Discard (Yandan Çekilecek Taş) */}
            <div className="flex flex-col items-center gap-1">
              <button 
                onClick={handleDrawFromDiscard}
                disabled={!canDraw || !previousPlayerDiscard}
                className={`relative rounded-lg transition-all ${
                  canDraw && previousPlayerDiscard 
                    ? 'ring-4 ring-blue-400 hover:scale-105 cursor-pointer animate-pulse' 
                    : 'cursor-default opacity-80'
                }`}
                title={canDraw && previousPlayerDiscard ? "Yandan Atılan Taşı Al" : "Yandan Atılan"}
              >
                {previousPlayerDiscard ? (
                  <>
                    <TileView tile={previousPlayerDiscard} size="md" />
                    <span className={`absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] font-bold px-1.5 py-0.2 rounded-full shadow whitespace-nowrap ${
                      canDraw ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'
                    }`}>
                      {canDraw ? 'Yandan Al' : 'Yandaki'}
                    </span>
                  </>
                ) : (
                  <div className="w-11 h-16 sm:w-13 sm:h-18 bg-slate-800/40 rounded-lg border border-dashed border-slate-600 flex items-center justify-center text-[10px] text-slate-500">
                    Yan Boş
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Game End Modal / Banner */}
          {currentRoom.status === 'ended' && (
            <div className="bg-slate-900/95 p-4 sm:p-5 rounded-2xl border-2 border-emerald-500 shadow-2xl text-center max-w-sm w-full animate-in fade-in zoom-in">
              <Trophy className="text-amber-400 w-12 h-12 mx-auto mb-2 animate-bounce" />
              <h3 className="text-lg font-black text-white">Tebrikler!</h3>
              <p className="text-xs text-slate-300 mt-1 mb-3">{currentRoom.winningReason}</p>
              <button 
                onClick={startGame}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow transition-colors"
              >
                Yeni El Başlat
              </button>
            </div>
          )}
        </div>

        {/* Player Action Buttons Toolbar */}
        <div className="w-full max-w-3xl mx-auto flex items-center justify-between gap-1 sm:gap-2 px-1 z-10">
          <div className="flex items-center gap-1.5">
            <button 
              onClick={handleSortRuns}
              className="px-2.5 sm:px-3 py-1 bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-[11px] sm:text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 border border-slate-700 shadow"
              title="Taşları renklere ve sayılara göre serilere diz"
            >
              <Layers size={13} className="text-emerald-400" /> Seri Sırala
            </button>
            <button 
              onClick={handleSortPairs}
              className="px-2.5 sm:px-3 py-1 bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-[11px] sm:text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 border border-slate-700 shadow"
              title="Aynı taşları yan yana çiftlere diz"
            >
              <CheckCircle2 size={13} className="text-blue-400" /> Çift Sırala
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Selected Discard Button */}
            {selectedSlot !== null && canDiscard && (
              <button 
                onClick={() => handleDiscard(selectedSlot)}
                className="px-3 sm:px-4 py-1 bg-red-600 hover:bg-red-700 text-white text-[11px] sm:text-xs font-bold rounded-lg shadow animate-pulse flex items-center gap-1"
              >
                <ArrowDown size={13} /> Taşı At
              </button>
            )}

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
        <div className="w-full max-w-4xl mx-auto z-10 origin-bottom pt-1">
          <div className="bg-gradient-to-b from-[#7a3e14] via-[#5c2b09] to-[#381a04] p-1 sm:p-2 rounded-t-2xl border-t-2 border-amber-600/80 shadow-2xl relative">
            
            {/* Top Row of Istaka */}
            <div className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-0.5 sm:gap-1 pb-1 border-b border-[#381a04]">
              {rack.slice(0, 15).map((tile, idx) => (
                <RackSlot 
                  key={idx}
                  slotIndex={idx}
                  tile={tile}
                  isSelected={selectedSlot === idx}
                  onClick={() => handleSlotClick(idx)}
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDropOnSlot(e, idx)}
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
                    onClick={() => handleSlotClick(realIdx)}
                    onDragStart={(e) => handleDragStart(e, realIdx)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropOnSlot(e, realIdx)}
                  />
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// Subcomponents: Single Rack Slot
function RackSlot({ 
  slotIndex, 
  tile, 
  isSelected, 
  onClick, 
  onDragStart, 
  onDragOver, 
  onDrop 
}: { 
  slotIndex: number; 
  tile: Tile | null; 
  isSelected: boolean; 
  onClick: () => void; 
  onDragStart: (e: React.DragEvent) => void; 
  onDragOver: (e: React.DragEvent) => void; 
  onDrop: (e: React.DragEvent) => void; 
}) {
  return (
    <div 
      onClick={onClick}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`aspect-[2/3] max-w-[44px] bg-[#3a1a03]/80 rounded-[3px] sm:rounded-sm border border-[#2b1201] flex items-center justify-center relative shadow-inner cursor-pointer transition-transform select-none ${
        isSelected ? 'ring-2 ring-emerald-400 -translate-y-1.5 sm:-translate-y-2 z-20 shadow-xl' : ''
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
    sm: 'w-6 h-9 text-xs rounded-[2px]',
    md: 'w-11 h-16 sm:w-13 sm:h-18 text-base sm:text-xl rounded-md',
    rack: 'w-full h-full text-[13px] xs:text-sm sm:text-base md:text-xl rounded-[2px] sm:rounded-sm'
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
