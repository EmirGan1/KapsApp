import React, { useState, useEffect, useRef } from 'react';
import { 
  Gamepad2, Users, RefreshCcw, LogOut, Plus, Play, 
  ArrowDown, CheckCircle2, Trophy, Sparkles, Layers, 
  AlertCircle, ChevronRight, HelpCircle, Check, Crown,
  MessageSquare, Send, X, Volume2, VolumeX, ShieldAlert,
  Flame, Clock
} from 'lucide-react';
import { Socket } from 'socket.io-client';
import Avatar from './Avatar';
import { 
  Tile101, 
  Okey101RoomState, 
  Okey101Meld,
  isTileOkey, 
  findBestMeldsInHand, 
  findPairsInHand,
  canAppendTileToMeld 
} from '../utils/okey101Engine';
import { okeyAudio } from '../utils/okeyAudio';

const INITIAL_RACK_SIZE = 30; // 2 rows x 15 slots

export default function Okey101Board({
  socket,
  currentUserId,
  username,
  avatar,
  color,
  onBackToHub,
  onRoomStateChange
}: {
  socket: Socket | null;
  currentUserId: number;
  username: string;
  avatar?: string | null;
  color?: string | null;
  onBackToHub?: () => void;
  onRoomStateChange?: (inRoom: boolean) => void;
}) {
  const [rooms, setRooms] = useState<any[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Okey101RoomState | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newRoomName, setNewRoomName] = useState('101 Okey Masası');
  const [newRoomSubMode, setNewRoomSubMode] = useState<'katlamali' | 'duz'>('katlamali');

  // Rack & Selection state
  const [rack, setRack] = useState<(Tile101 | null)[]>(Array(INITIAL_RACK_SIZE).fill(null));
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [draggedSlot, setDraggedSlot] = useState<number | null>(null);
  const [selectedTileForAppend, setSelectedTileForAppend] = useState<Tile101 | null>(null);
  const [isOverDiscardZone, setIsOverDiscardZone] = useState(false);

  // Mute toggle
  const [isMuted, setIsMuted] = useState(false);

  // Messages & Toast feedback
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Table chat
  const [tableMessages, setTableMessages] = useState<any[]>([]);
  const [isTableChatOpen, setIsTableChatOpen] = useState(false);
  const [tableChatInput, setTableChatInput] = useState('');
  const tableChatEndRef = useRef<HTMLDivElement>(null);

  // Touch drag state
  const [touchDragState, setTouchDragState] = useState<{
    slotIndex: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    isDragging: boolean;
    tile: Tile101;
  } | null>(null);
  const touchDragRef = useRef<any>(null);

  // Double click / touch detection
  const lastClickRef = useRef<{ slot: number; time: number }>({ slot: -1, time: 0 });

  // Sound effects helper
  const playSound = (type: 'draw' | 'discard' | 'open' | 'append' | 'tick' | 'penalty' | 'win') => {
    if (isMuted) return;
    if (type === 'draw') okeyAudio.playDrawTile();
    else if (type === 'discard') okeyAudio.playDiscardTile();
    else if (type === 'open') okeyAudio.playOpenMelds();
    else if (type === 'append') okeyAudio.playAppendTile();
    else if (type === 'tick') okeyAudio.playTimerTick();
    else if (type === 'penalty') okeyAudio.playPenalty();
    else if (type === 'win') okeyAudio.playVictory();
  };

  // Socket setup
  useEffect(() => {
    if (!socket) return;

    socket.emit("get_okey101_rooms");
    socket.emit("get_my_okey101_room");
    socket.emit("get_my_okey101_hand");

    const onRoomsList = (list: any[]) => {
      setRooms(list || []);
    };

    const onRoomState = (state: Okey101RoomState | null) => {
      setCurrentRoom(state);
      if (onRoomStateChange) {
        onRoomStateChange(!!state);
      }
      if (state && state.status === 'playing') {
        socket.emit("get_my_okey101_hand");
      }
      if (state && state.winnerId) {
        playSound('win');
      }
    };

    const onHand = (hand: Tile101[]) => {
      // Preserve existing arrangement if possible, or place sequentially
      setRack((prev) => {
        const next: (Tile101 | null)[] = Array(INITIAL_RACK_SIZE).fill(null);
        const availableHand = [...hand];

        // 1. Keep tiles already on the rack in their current slots if still present in hand
        for (let i = 0; i < prev.length; i++) {
          const t = prev[i];
          if (t) {
            const hIdx = availableHand.findIndex((h) => h.id === t.id);
            if (hIdx !== -1) {
              next[i] = availableHand.splice(hIdx, 1)[0];
            }
          }
        }

        // 2. Put remaining newly drawn tiles in the first free slots
        for (const t of availableHand) {
          const freeIdx = next.findIndex((slot) => slot === null);
          if (freeIdx !== -1) {
            next[freeIdx] = t;
          }
        }

        return next;
      });
    };

    const onError = (msg: string) => {
      setErrorMessage(msg);
      playSound('penalty');
      setTimeout(() => setErrorMessage(null), 4000);
    };

    const onInfo = (msg: string) => {
      setInfoMessage(msg);
      setTimeout(() => setInfoMessage(null), 4000);
    };

    const onTableChat = (msgs: any[]) => {
      setTableMessages(msgs || []);
    };

    const onNewTableMsg = (msg: any) => {
      setTableMessages((prev) => [...prev, msg]);
    };

    socket.on("okey101_rooms_list", onRoomsList);
    socket.on("okey101_state", onRoomState);
    socket.on("okey101_hand", onHand);
    socket.on("okey101_error", onError);
    socket.on("okey101_info", onInfo);
    socket.on("okey101_chat_history", onTableChat);
    socket.on("okey101_new_table_message", onNewTableMsg);

    return () => {
      socket.off("okey101_rooms_list", onRoomsList);
      socket.off("okey101_state", onRoomState);
      socket.off("okey101_hand", onHand);
      socket.off("okey101_error", onError);
      socket.off("okey101_info", onInfo);
      socket.off("okey101_chat_history", onTableChat);
      socket.off("okey101_new_table_message", onNewTableMsg);
    };
  }, [socket]);

  // Sync mute state to audio manager
  useEffect(() => {
    okeyAudio.setMuted(isMuted);
  }, [isMuted]);

  // Auto-scroll chat
  useEffect(() => {
    if (isTableChatOpen) {
      tableChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [tableMessages, isTableChatOpen]);

  // Play tick sound when turnTimeRemaining <= 5 and it's player's turn
  useEffect(() => {
    if (!currentRoom || currentRoom.status !== 'playing') return;
    const isMyTurn = currentRoom.players[currentRoom.currentTurn]?.id === currentUserId;
    if (isMyTurn && currentRoom.turnTimeRemaining <= 5 && currentRoom.turnTimeRemaining > 0) {
      playSound('tick');
    }
  }, [currentRoom?.turnTimeRemaining]);

  // Calculate live hand meld potential
  const currentHandTiles = rack.filter((t): t is Tile101 => t !== null);
  const meldAnalysis = findBestMeldsInHand(currentHandTiles, currentRoom?.okeyTile);
  const pairAnalysis = findPairsInHand(currentHandTiles, currentRoom?.okeyTile);

  const minScoreNeeded = currentRoom
    ? currentRoom.subMode === 'katlamali'
      ? Math.max(101, currentRoom.highestOpenScore + 1)
      : 101
    : 101;

  const minPairsNeeded = currentRoom
    ? currentRoom.subMode === 'katlamali' && currentRoom.highestPairsCount
      ? currentRoom.highestPairsCount + 1
      : 5
    : 5;

  const canOpenSerial = meldAnalysis.totalScore >= minScoreNeeded;
  const canOpenPairs = pairAnalysis.pairs.length >= minPairsNeeded;

  const isMyTurn = currentRoom && currentRoom.status === 'playing'
    ? currentRoom.players[currentRoom.currentTurn]?.id === currentUserId
    : false;

  const canDiscard = isMyTurn && currentRoom?.turnPhase === 'discard';

  const myPlayer = currentRoom?.players.find((p) => p.id === currentUserId);

  // --- Hand Actions ---

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !newRoomName.trim()) return;
    socket.emit("create_okey101_room", {
      name: newRoomName.trim(),
      subMode: newRoomSubMode
    });
    setIsCreating(false);
  };

  const handleJoinRoom = (roomId: string) => {
    if (!socket) return;
    socket.emit("join_okey101", roomId);
  };

  const handleLeaveRoom = () => {
    if (!socket) return;
    socket.emit("leave_okey101");
    setCurrentRoom(null);
    setRack(Array(INITIAL_RACK_SIZE).fill(null));
    if (onRoomStateChange) onRoomStateChange(false);
  };

  const handleStartGame = () => {
    if (!socket || !currentRoom) return;
    socket.emit("start_okey101_game", { roomId: currentRoom.id }, (res: any) => {
      if (res?.error) {
        setErrorMessage(res.error);
        setTimeout(() => setErrorMessage(null), 3500);
      }
    });
    setTimeout(() => {
      socket.emit("get_my_okey101_hand");
    }, 300);
  };

  const handleAddBot = () => {
    if (!socket || !currentRoom) return;
    socket.emit("add_okey101_bot", { roomId: currentRoom.id }, (res: any) => {
      if (res?.error) {
        setErrorMessage(res.error);
        setTimeout(() => setErrorMessage(null), 3000);
      }
    });
  };

  const handleDraw = (source: 'deck' | 'discard') => {
    if (!socket || !isMyTurn || currentRoom?.turnPhase !== 'draw') return;
    playSound('draw');
    socket.emit("okey101_draw", { source });
  };

  const handleDiscard = (slotIndex: number) => {
    if (!socket || !isMyTurn || currentRoom?.turnPhase !== 'discard') return;
    const tile = rack[slotIndex];
    if (!tile) return;

    playSound('discard');
    socket.emit("okey101_discard", { tileId: tile.id });
    setSelectedSlot(null);
    setSelectedTileForAppend(null);
  };

  const handleOpenMelds = () => {
    if (!socket || !isMyTurn || currentRoom?.turnPhase !== 'discard') return;
    if (!canOpenSerial) {
      setErrorMessage(`Açılabilir per toplamı (${meldAnalysis.totalScore}) barajı (${minScoreNeeded}) geçmiyor.`);
      playSound('penalty');
      return;
    }

    playSound('open');
    socket.emit("okey101_open_hand", {
      type: 'serial',
      melds: meldAnalysis.melds
    });
  };

  const handleOpenPairs = () => {
    if (!socket || !isMyTurn || currentRoom?.turnPhase !== 'discard') return;
    if (!canOpenPairs) {
      setErrorMessage(`Çift açmak için en az ${minPairsNeeded} çift gereklidir (Şu an: ${pairAnalysis.pairs.length} çift).`);
      playSound('penalty');
      return;
    }

    playSound('open');
    socket.emit("okey101_open_hand", {
      type: 'double',
      melds: pairAnalysis.pairs
    });
  };

  const handleAppendTileToMeld = (meld: Okey101Meld) => {
    if (!socket || !isMyTurn || !myPlayer?.hasOpened || !selectedTileForAppend) return;

    if (myPlayer.openedMode === 'double' && meld.type !== 'pair') {
      setErrorMessage("Çift açtığınız için sadece çift perlere taş işleyebilirsiniz.");
      playSound('penalty');
      return;
    }

    const check = canAppendTileToMeld(selectedTileForAppend, meld, currentRoom?.okeyTile);
    if (!check.canAppend) {
      setErrorMessage(check.error || "Seçtiğiniz taş bu pere işlenemez.");
      playSound('penalty');
      return;
    }

    playSound('append');
    socket.emit("okey101_append_tile", {
      meldId: meld.id,
      tileId: selectedTileForAppend.id
    });
    setSelectedTileForAppend(null);
  };

  const handleDeclareFinish = () => {
    if (!socket || !isMyTurn) return;
    // Prompt confirmation or finish directly
    const discardId = selectedSlot !== null && rack[selectedSlot] ? rack[selectedSlot]?.id : undefined;
    socket.emit("okey101_declare_finish", { discardTileId: discardId });
  };

  const handleAutoSortRuns = () => {
    if (currentHandTiles.length === 0) return;
    const sortedMelds = meldAnalysis.melds;
    const unmelded = meldAnalysis.unmelded;

    const newRack: (Tile101 | null)[] = Array(INITIAL_RACK_SIZE).fill(null);
    let slot = 0;

    // Place melds with 1 blank space between them
    for (const meld of sortedMelds) {
      if (slot + meld.length > INITIAL_RACK_SIZE) break;
      for (const t of meld) {
        newRack[slot++] = t;
      }
      if (slot < INITIAL_RACK_SIZE) slot++; // Gap
    }

    // Place remaining unmelded
    for (const t of unmelded) {
      const freeIdx = newRack.findIndex((s) => s === null);
      if (freeIdx !== -1) newRack[freeIdx] = t;
    }

    setRack(newRack);
    playSound('draw');
  };

  const handleAutoSortPairs = () => {
    if (currentHandTiles.length === 0) return;
    const sortedPairs = pairAnalysis.pairs;
    const unmelded = pairAnalysis.unmelded;

    const newRack: (Tile101 | null)[] = Array(INITIAL_RACK_SIZE).fill(null);
    let slot = 0;

    for (const pair of sortedPairs) {
      if (slot + 2 > INITIAL_RACK_SIZE) break;
      newRack[slot++] = pair[0];
      newRack[slot++] = pair[1];
      if (slot < INITIAL_RACK_SIZE) slot++; // Gap
    }

    for (const t of unmelded) {
      const freeIdx = newRack.findIndex((s) => s === null);
      if (freeIdx !== -1) newRack[freeIdx] = t;
    }

    setRack(newRack);
    playSound('draw');
  };

  // --- Slot Click & Swap Management ---

  const handleSlotClick = (index: number) => {
    const tile = rack[index];
    const now = Date.now();

    // Double click to discard (if in discard phase)
    if (lastClickRef.current.slot === index && now - lastClickRef.current.time < 350) {
      if (tile && isMyTurn && currentRoom?.turnPhase === 'discard') {
        handleDiscard(index);
        lastClickRef.current = { slot: -1, time: 0 };
        return;
      }
    }
    lastClickRef.current = { slot: index, time: now };

    if (selectedSlot === null) {
      if (tile) {
        setSelectedSlot(index);
        setSelectedTileForAppend(tile);
      }
    } else {
      if (selectedSlot === index) {
        setSelectedSlot(null);
        setSelectedTileForAppend(null);
      } else {
        // Swap slots
        const newRack = [...rack];
        const temp = newRack[selectedSlot];
        newRack[selectedSlot] = newRack[index];
        newRack[index] = temp;
        setRack(newRack);
        setSelectedSlot(null);
        setSelectedTileForAppend(null);
        playSound('draw');
      }
    }
  };

  // --- Mouse & Touch Drag and Drop (Swap in Rack & Discard to Board) ---

  const handleDragStart = (e: React.DragEvent, slotIndex: number) => {
    setDraggedSlot(slotIndex);
    e.dataTransfer.setData("text/plain", slotIndex.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOverSlot = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetSlotIndex: number) => {
    e.preventDefault();
    if (draggedSlot === null) return;
    if (draggedSlot !== targetSlotIndex) {
      setRack(prev => {
        const next = [...prev];
        const temp = next[draggedSlot];
        next[draggedSlot] = next[targetSlotIndex];
        next[targetSlotIndex] = temp;
        return next;
      });
      playSound('draw');
    }
    setDraggedSlot(null);
    setSelectedSlot(null);
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

  const handleTouchEndSlot = () => {
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
          playSound('draw');
        }
      }
    } else {
      handleSlotClick(slotIndex);
    }

    touchDragRef.current = null;
    setTouchDragState(null);
    setIsOverDiscardZone(false);
  };

  const sendTableChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !tableChatInput.trim() || !currentRoom) return;
    socket.emit("send_okey101_table_message", {
      text: tableChatInput.trim()
    });
    setTableChatInput('');
  };

  // Helper tile color classes
  const getTileColorClass = (color: string) => {
    switch (color) {
      case 'red': return 'text-red-600 dark:text-red-500 fill-red-600';
      case 'blue': return 'text-blue-600 dark:text-blue-500 fill-blue-600';
      case 'black': return 'text-slate-900 dark:text-slate-100 fill-slate-900';
      case 'yellow': return 'text-amber-500 dark:text-amber-400 fill-amber-500';
      default: return 'text-purple-600 fill-purple-600';
    }
  };

  // Render Single Tile Component
  const renderTileComponent = (
    tile: Tile101, 
    isSelected: boolean = false, 
    size: 'sm' | 'md' | 'lg' = 'md',
    onClick?: () => void
  ) => {
    const isOkey = isTileOkey(tile, currentRoom?.okeyTile);
    const sizeClasses = {
      sm: 'w-6 h-8.5 text-[10px] sm:w-7 sm:h-10 sm:text-xs',
      md: 'w-6 h-9.5 text-xs sm:w-8 sm:h-12 sm:text-sm md:w-9.5 md:h-13.5 md:text-base lg:w-10.5 lg:h-15 lg:text-lg',
      lg: 'w-8.5 h-12 text-sm sm:w-10 sm:h-15 sm:text-lg'
    }[size];

    return (
      <div
        onClick={onClick}
        className={`relative ${sizeClasses} rounded-lg bg-gradient-to-b from-amber-50 to-amber-100 dark:from-slate-800 dark:to-slate-900 border-2 shadow-md flex flex-col items-center justify-between p-1 select-none transition-transform active:scale-95 cursor-pointer ${
          isSelected 
            ? 'border-blue-500 ring-2 ring-blue-400 scale-105 z-10' 
            : 'border-amber-200/90 dark:border-slate-700 hover:border-blue-400'
        }`}
      >
        {/* Top Mini Color Pip */}
        <div className="w-full flex justify-between items-center px-0.5">
          <span className={`font-black leading-none ${getTileColorClass(tile.color)} text-[10px] sm:text-xs`}>
            {tile.isFake ? '★' : tile.number}
          </span>
          {isOkey && (
            <span className="text-[9px] bg-red-600 text-white rounded-full px-1 font-bold animate-pulse">
              J
            </span>
          )}
        </div>

        {/* Center Main Symbol/Number */}
        <div className={`font-black ${getTileColorClass(tile.color)} drop-shadow-sm`}>
          {tile.isFake ? (
            <span className="text-purple-600 text-xs sm:text-sm font-black">★</span>
          ) : (
            tile.number
          )}
        </div>

        {/* Bottom indicator dot / line */}
        <div className="w-full flex justify-center pb-0.5">
          <div className={`w-2.5 h-1 rounded-full ${
            tile.color === 'red' ? 'bg-red-500' :
            tile.color === 'blue' ? 'bg-blue-500' :
            tile.color === 'black' ? 'bg-slate-900 dark:bg-white' :
            tile.color === 'yellow' ? 'bg-amber-500' : 'bg-purple-500'
          }`} />
        </div>
      </div>
    );
  };

  // --- LOBBY VIEW (When not in room) ---
  if (!currentRoom) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 flex flex-col">
        {/* Header */}
        <div className="max-w-5xl w-full mx-auto flex items-center justify-between pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToHub}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Oyun Merkezine Dön"
            >
              <LogOut size={20} className="rotate-180" />
            </button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <span className="text-amber-500">🀄</span> 101 Okey Salonu
              </h1>
              <p className="text-xs md:text-sm text-slate-400">
                Uluslararası kurallara uygun Katlamalı ve Düz 101 Okey
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title={isMuted ? "Sesi Aç" : "Sesi Kapat"}
            >
              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <button
              onClick={() => setIsCreating(true)}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-xl shadow-lg transition-all flex items-center gap-2"
            >
              <Plus size={18} />
              <span>Yeni Masa Kur</span>
            </button>
          </div>
        </div>

        {/* Modal: Create Room */}
        {isCreating && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-slate-700">
                <h3 className="text-lg font-bold">101 Okey Masası Aç</h3>
                <button
                  onClick={() => setIsCreating(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateRoom} className="space-y-4 mt-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Masa Adı
                  </label>
                  <input
                    type="text"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 text-sm"
                    placeholder="Masa adı giriniz..."
                    maxLength={30}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2">
                    Oyun Modu
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setNewRoomSubMode('katlamali')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        newRoomSubMode === 'katlamali'
                          ? 'border-amber-500 bg-amber-500/10 text-white'
                          : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-sm">
                        <Flame size={16} className="text-amber-500" /> Katlamalı
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Her el açan, masadaki en yüksek puandan en az 1 fazla açmak zorundadır.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewRoomSubMode('duz')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        newRoomSubMode === 'duz'
                          ? 'border-amber-500 bg-amber-500/10 text-white'
                          : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-sm">
                        <Layers size={16} className="text-blue-400" /> Düz 101
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Tüm oyuncular için baraj sabit 101 puandır.
                      </p>
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-xl transition-all"
                  >
                    Masayı Başlat
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Room List */}
        <div className="max-w-5xl w-full mx-auto mt-6 flex-1">
          {rooms.length === 0 ? (
            <div className="text-center py-16 bg-slate-800/40 rounded-3xl border border-slate-800/80 p-8">
              <Gamepad2 size={48} className="mx-auto text-amber-500/60 mb-3" />
              <h3 className="text-lg font-bold text-slate-300">Henüz Açık Masa Yok</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-6">
                Hemen yeni bir 101 Okey masası kurarak botlarla veya arkadaşlarınla oyna!
              </p>
              <button
                onClick={() => setIsCreating(true)}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-xl inline-flex items-center gap-2"
              >
                <Plus size={18} /> Masa Oluştur
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-5 hover:border-amber-500/50 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 capitalize">
                        {room.subMode === 'katlamali' ? '🔥 Katlamalı' : '🔹 Düz 101'}
                      </span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Users size={14} /> {room.players?.length || 0}/4
                      </span>
                    </div>
                    <h3 className="font-bold text-base text-white truncate">{room.name}</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Masa Yöneticisi: {room.players?.[0]?.username || 'Bilinmiyor'}
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-700/50 flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      {room.status === 'playing' ? '🔴 Oyunda' : '🟢 Bekliyor'}
                    </span>
                    <button
                      onClick={() => handleJoinRoom(room.id)}
                      className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-xl transition-all flex items-center gap-1.5"
                    >
                      <span>Masaya Gir</span>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- ACTIVE GAME TABLE VIEW ---

  const prevPlayerIdx = (currentRoom.currentTurn + currentRoom.players.length - 1) % currentRoom.players.length;
  const prevPlayer = currentRoom.players[prevPlayerIdx];
  const sideDiscardTile = prevPlayer?.discardPile?.[prevPlayer.discardPile.length - 1];

  return (
    <div className="h-full w-full max-h-[100dvh] bg-emerald-950 text-slate-100 flex flex-col justify-between relative overflow-hidden select-none font-sans">
      
      {/* Toast Alert Feedback */}
      {errorMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 text-sm font-semibold animate-bounce">
          <ShieldAlert size={18} />
          <span>{errorMessage}</span>
        </div>
      )}
      {infoMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-amber-600 text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 text-sm font-semibold">
          <Sparkles size={18} />
          <span>{infoMessage}</span>
        </div>
      )}

      {/* TOP BAR: Room Info, Mode, Timer, Okey Tile, Controls */}
      <div className="shrink-0 bg-black/40 backdrop-blur-md px-3 py-1.5 sm:px-4 sm:py-2 border-b border-emerald-900/60 flex items-center justify-between z-20">
        <div className="flex items-center gap-2 md:gap-4">
          <button
            onClick={handleLeaveRoom}
            className="p-1.5 rounded-lg bg-emerald-900/40 hover:bg-red-600/80 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Masadan Ayrıl"
          >
            <LogOut size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm md:text-base text-amber-300 truncate max-w-[140px] md:max-w-xs">
                {currentRoom.name}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {currentRoom.subMode === 'katlamali' ? 'Katlamalı' : 'Düz 101'}
              </span>
            </div>
            <p className="text-[11px] text-emerald-300/70">
              En Yüksek Baraj: <span className="font-bold text-amber-400">{minScoreNeeded} Puan</span>
            </p>
          </div>
        </div>

        {/* Center: Turn Timer & Turn Notice */}
        <div className="flex items-center gap-3">
          {currentRoom.status === 'playing' ? (
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs md:text-sm font-bold ${
              isMyTurn
                ? currentRoom.turnTimeRemaining <= 5
                  ? 'bg-red-600/80 border-red-500 text-white animate-pulse'
                  : 'bg-emerald-600/80 border-emerald-400 text-white'
                : 'bg-black/60 border-emerald-900 text-emerald-300'
            }`}>
              <Clock size={16} />
              <span>{isMyTurn ? `Sıra Sende (${currentRoom.turnTimeRemaining}s)` : `${currentRoom.players[currentRoom.currentTurn]?.username} (${currentRoom.turnTimeRemaining}s)`}</span>
            </div>
          ) : (
            <div className="text-xs text-amber-300 bg-amber-500/20 px-3 py-1 rounded-full border border-amber-500/30">
              Oyuncular bekleniyor ({currentRoom.players.length}/4)
            </div>
          )}
        </div>

        {/* Right: Sound, Chat toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-1.5 rounded-lg bg-emerald-900/40 hover:bg-emerald-800 text-slate-300 transition-colors cursor-pointer"
            title={isMuted ? "Sesi Aç" : "Sesi Kapat"}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button
            onClick={() => setIsTableChatOpen(!isTableChatOpen)}
            className="p-1.5 rounded-lg bg-emerald-900/40 hover:bg-emerald-800 text-slate-300 relative transition-colors cursor-pointer"
            title="Masa Sohbeti"
          >
            <MessageSquare size={18} />
          </button>
        </div>
      </div>

      {/* TABLE CHAT DRAWER */}
      {isTableChatOpen && (
        <div className="absolute top-12 right-2 z-40 w-72 bg-slate-900/95 border border-emerald-800 rounded-2xl shadow-2xl p-3 flex flex-col h-80">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-bold text-emerald-400">Masa Sohbeti</span>
            <button onClick={() => setIsTableChatOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 py-2 text-xs">
            {tableMessages.map((m, idx) => (
              <div key={idx} className="bg-slate-800/80 rounded-lg p-2">
                <span className="font-bold text-amber-400">{m.sender}: </span>
                <span className="text-slate-200">{m.text}</span>
              </div>
            ))}
            <div ref={tableChatEndRef} />
          </div>
          <form onSubmit={sendTableChat} className="flex gap-1 pt-2 border-t border-slate-800">
            <input
              type="text"
              value={tableChatInput}
              onChange={(e) => setTableChatInput(e.target.value)}
              placeholder="Mesaj yaz..."
              className="flex-1 bg-slate-800 rounded-lg px-2.5 py-1 text-xs text-white outline-none"
              maxLength={100}
            />
            <button type="submit" className="p-1.5 bg-amber-600 rounded-lg text-white cursor-pointer">
              <Send size={14} />
            </button>
          </form>
        </div>
      )}

      {/* MAIN PLAY AREA: TABLE CENTER & PLAYERS */}
      <div className="flex-1 min-h-0 flex flex-col justify-between p-1.5 sm:p-2 md:p-3 max-w-6xl w-full mx-auto relative overflow-y-auto no-scrollbar">
        
        {/* Opponents Seats (Top, Left, Right) */}
        <div className="flex justify-between items-center text-xs">
          {/* Left Player */}
          {currentRoom.players[1] && (
            <div className={`p-2 rounded-xl backdrop-blur-sm border flex items-center gap-2 ${
              currentRoom.currentTurn === 1 ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/50' : 'bg-black/40 border-emerald-900/60'
            }`}>
              <Avatar url={currentRoom.players[1].avatar} name={currentRoom.players[1].username} size={8} />
              <div>
                <p className="font-bold text-slate-100">{currentRoom.players[1].username}</p>
                <p className="text-[10px] text-emerald-300">{currentRoom.players[1].tileCount ?? currentRoom.players[1].hand?.length ?? 0} Taş • {currentRoom.players[1].hasOpened ? 'Açtı' : 'Açmadı'}</p>
              </div>
            </div>
          )}

          {/* Top Player (Facing) */}
          {currentRoom.players[2] && (
            <div className={`p-2 rounded-xl backdrop-blur-sm border flex items-center gap-2 ${
              currentRoom.currentTurn === 2 ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/50' : 'bg-black/40 border-emerald-900/60'
            }`}>
              <Avatar url={currentRoom.players[2].avatar} name={currentRoom.players[2].username} size={8} />
              <div>
                <p className="font-bold text-slate-100">{currentRoom.players[2].username}</p>
                <p className="text-[10px] text-emerald-300">{currentRoom.players[2].tileCount ?? currentRoom.players[2].hand?.length ?? 0} Taş • {currentRoom.players[2].hasOpened ? 'Açtı' : 'Açmadı'}</p>
              </div>
            </div>
          )}

          {/* Right Player */}
          {currentRoom.players[3] && (
            <div className={`p-2 rounded-xl backdrop-blur-sm border flex items-center gap-2 ${
              currentRoom.currentTurn === 3 ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/50' : 'bg-black/40 border-emerald-900/60'
            }`}>
              <Avatar url={currentRoom.players[3].avatar} name={currentRoom.players[3].username} size={8} />
              <div>
                <p className="font-bold text-slate-100">{currentRoom.players[3].username}</p>
                <p className="text-[10px] text-emerald-300">{currentRoom.players[3].tileCount ?? currentRoom.players[3].hand?.length ?? 0} Taş • {currentRoom.players[3].hasOpened ? 'Açtı' : 'Açmadı'}</p>
              </div>
            </div>
          )}
        </div>

        {/* CENTER TABLE: DECK, DISCARD PILE, OKEY INDICATOR & OPENED MELDS */}
        <div className="flex-1 my-3 bg-emerald-900/30 rounded-3xl border-2 border-emerald-800/60 p-3 md:p-5 flex flex-col justify-between shadow-inner">
          
          {/* Deck & Discard Actions */}
          <div className="flex items-center justify-center gap-6 md:gap-10 pb-2 border-b border-emerald-800/40">
            {/* Okey Reference Tile */}
            {currentRoom.okeyTile && (
              <div className="flex flex-col items-center">
                <span className="text-[10px] uppercase font-bold text-amber-400 mb-1">OKEY TAŞI</span>
                {renderTileComponent(currentRoom.okeyTile, false, 'md')}
              </div>
            )}

            {/* Deck Pile (Draw Button) */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] uppercase font-bold text-emerald-300 mb-1">
                DESTE ({currentRoom.deckCount})
              </span>
              <button
                type="button"
                onClick={() => handleDraw('deck')}
                disabled={!isMyTurn || currentRoom.turnPhase !== 'draw'}
                className="w-10 h-14 md:w-12 md:h-18 rounded-lg bg-gradient-to-b from-amber-800 to-amber-950 border-2 border-amber-600/80 shadow-xl flex items-center justify-center font-bold text-amber-200 active:scale-95 disabled:opacity-60 cursor-pointer"
              >
                🀄
              </button>
            </div>

            {/* Side Tile (Draw from previous player's discard) */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] uppercase font-bold text-emerald-300 mb-1">YANDAN ÇEK</span>
              {sideDiscardTile ? (
                <button
                  type="button"
                  onClick={() => handleDraw('discard')}
                  disabled={!isMyTurn || currentRoom.turnPhase !== 'draw'}
                  className="disabled:opacity-40 cursor-pointer active:scale-95"
                >
                  {renderTileComponent(sideDiscardTile, false, 'md')}
                </button>
              ) : (
                <div className="w-10 h-14 md:w-12 md:h-18 rounded-lg border-2 border-dashed border-emerald-700/60 flex items-center justify-center text-[10px] text-emerald-600">
                  Boş
                </div>
              )}
            </div>

            {/* Drop / Discard Target Zone */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] uppercase font-bold text-red-400 mb-1">YANA TAŞ AT</span>
              <div
                data-drop-zone="discard"
                onDragOver={handleDragOverDiscard}
                onDragLeave={handleDragLeaveDiscard}
                onDrop={handleDropOnDiscard}
                onClick={() => {
                  if (selectedSlot !== null) {
                    if (canDiscard) handleDiscard(selectedSlot);
                    else {
                      setErrorMessage("Sıra sizde değil veya henüz taş çekmediniz.");
                      setTimeout(() => setErrorMessage(null), 3000);
                    }
                  }
                }}
                className={`w-11 h-15 md:w-13 md:h-19 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-xs font-bold transition-all cursor-pointer select-none ${
                  isOverDiscardZone
                    ? 'border-red-400 bg-red-600/50 text-white scale-110 shadow-2xl ring-4 ring-red-400/80 animate-pulse'
                    : canDiscard
                      ? 'border-red-500 bg-red-950/50 text-red-300 animate-pulse hover:bg-red-900/60 hover:scale-105'
                      : 'border-emerald-800/80 text-emerald-700 opacity-60'
                }`}
                title="Taşı buraya sürükleyip bırakın veya seçiliyken tıklayın"
              >
                <ArrowDown size={20} className={isOverDiscardZone ? 'animate-bounce' : ''} />
                <span className="text-[10px] font-bold mt-0.5">Taş At</span>
              </div>
            </div>
          </div>

          {/* OPENED MELDS AREA (Masa Ortası Açılan Eller) */}
          <div className="flex-1 my-2 overflow-y-auto max-h-48 md:max-h-60 space-y-2 pr-1 scrollbar-thin">
            {currentRoom.openedMelds && currentRoom.openedMelds.length > 0 ? (
              <div className="flex flex-wrap gap-2.5 items-start justify-center">
                {currentRoom.openedMelds.map((meld) => (
                  <div
                    key={meld.id}
                    onClick={() => {
                      if (selectedTileForAppend && myPlayer?.hasOpened) {
                        handleAppendTileToMeld(meld);
                      }
                    }}
                    className={`bg-black/50 border rounded-xl p-1.5 flex flex-col gap-1 transition-all ${
                      selectedTileForAppend && myPlayer?.hasOpened
                        ? 'hover:border-amber-400 hover:scale-105 cursor-pointer border-amber-500/60 ring-2 ring-amber-500/30'
                        : 'border-emerald-800/80'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-emerald-400 px-1">
                      <span className="truncate max-w-[80px]">{meld.playerUsername}</span>
                      <span className="font-mono text-amber-300 font-bold">{meld.score}p</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {meld.tiles.map((t) => (
                        <div key={t.id}>{renderTileComponent(t, false, 'sm')}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-emerald-600/70 text-xs italic">
                Henüz masaya el açan oyuncu yok. İlk açan en az 101 puan toplamalıdır.
              </div>
            )}
          </div>

          {/* Action Status Bar */}
          {currentRoom.lastActionMessage && (
            <div className="text-center text-xs text-amber-300 font-medium py-1 px-3 bg-black/30 rounded-full w-fit mx-auto border border-emerald-900/60">
              {currentRoom.lastActionMessage}
            </div>
          )}
        </div>

        {/* WAITING ROOM HOST CONTROLS */}
        {currentRoom.status === 'waiting' && currentRoom.hostId === currentUserId && (
          <div className="my-2 bg-amber-950/80 border border-amber-500/40 rounded-2xl p-3 sm:p-4 text-center max-w-lg mx-auto shadow-xl">
            <h4 className="font-bold text-amber-300 text-sm mb-1">Masa Yöneticisisiniz</h4>
            <p className="text-xs text-slate-300 mb-3">
              Masa dolmadıysa "Bot Ekle" yapabilir veya doğrudan "Taşları Dağıt ve Başlat" diyerek eksik koltukları botlarla doldurarak oyunu anında başlatabilirsiniz.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleAddBot}
                disabled={currentRoom.players.length >= 4}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Plus size={16} />
                <span>Bot Ekle ({currentRoom.players.length}/4)</span>
              </button>
              <button
                type="button"
                onClick={handleStartGame}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold rounded-xl shadow-lg transition-all inline-flex items-center gap-2 cursor-pointer active:scale-95 text-xs sm:text-sm"
              >
                <Play size={18} />
                <span>Taşları Dağıt ve Başlat</span>
              </button>
            </div>
          </div>
        )}

      </div>

      {/* BOTTOM: TWO-ROW RACK (AHŞAP OKEY TAVLASI / ISTAKA) */}
      <div className="shrink-0 w-full bg-gradient-to-b from-[#2e180b] via-[#1c0e06] to-[#0f0703] border-t-2 border-amber-600/70 p-1.5 sm:p-2 md:p-3 shadow-2xl z-30">
        <div className="max-w-6xl mx-auto w-full">
          {/* Rack Controls Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 pb-1.5 mb-1.5 border-b border-amber-900/60 text-xs">
            {/* Live Hand Meld Score Counter */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-amber-200/90 font-medium text-[11px] sm:text-xs">Seri Barajı:</span>
              <span className={`font-mono font-bold px-2 py-0.5 rounded-full text-xs ${
                canOpenSerial ? 'bg-emerald-500 text-white animate-pulse' : 'bg-black/60 text-amber-400 border border-amber-500/30'
              }`}>
                {meldAnalysis.totalScore} / {minScoreNeeded}
              </span>
              <span className="text-slate-400 text-[11px]">
                ({pairAnalysis.pairs.length} Çift)
              </span>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-1 sm:gap-1.5">
              <button
                type="button"
                onClick={handleAutoSortRuns}
                className="px-2 py-1 bg-emerald-800/80 hover:bg-emerald-700 text-white text-[11px] sm:text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer border border-emerald-600/40"
                title="Serileri ve grupları otomatik diz"
              >
                <Layers size={13} />
                <span>Seri Diz</span>
              </button>

              <button
                type="button"
                onClick={handleAutoSortPairs}
                className="px-2 py-1 bg-indigo-800/80 hover:bg-indigo-700 text-white text-[11px] sm:text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer border border-indigo-600/40"
                title="Çiftleri otomatik diz"
              >
                <span>Çift Diz</span>
              </button>

              {/* Open Melds Button */}
              <button
                type="button"
                onClick={handleOpenMelds}
                disabled={!isMyTurn || currentRoom.turnPhase !== 'discard' || !canOpenSerial || myPlayer?.hasOpened}
                className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold transition-all shadow-md flex items-center gap-1 cursor-pointer ${
                  canOpenSerial && isMyTurn && !myPlayer?.hasOpened
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 animate-bounce'
                    : 'bg-black/40 text-slate-500 border border-slate-700/50 disabled:opacity-50'
                }`}
              >
                <Sparkles size={13} />
                <span>Seri Aç ({meldAnalysis.totalScore}p)</span>
              </button>

              {/* Open Pairs Button */}
              <button
                type="button"
                onClick={handleOpenPairs}
                disabled={!isMyTurn || currentRoom.turnPhase !== 'discard' || !canOpenPairs || myPlayer?.hasOpened}
                className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold transition-all shadow-md flex items-center gap-1 cursor-pointer ${
                  canOpenPairs && isMyTurn && !myPlayer?.hasOpened
                    ? 'bg-purple-600 hover:bg-purple-500 text-white'
                    : 'bg-black/40 text-slate-500 border border-slate-700/50 disabled:opacity-50'
                }`}
              >
                <span>Çift Aç (5+)</span>
              </button>

              {/* Toolbar Discard Drop Zone & Action Button */}
              <button
                type="button"
                data-drop-zone="discard"
                onDragOver={handleDragOverDiscard}
                onDragLeave={handleDragLeaveDiscard}
                onDrop={handleDropOnDiscard}
                onClick={() => {
                  if (selectedSlot !== null) {
                    if (canDiscard) handleDiscard(selectedSlot);
                    else {
                      setErrorMessage("Sıra sizde değil veya henüz taş çekmediniz.");
                      setTimeout(() => setErrorMessage(null), 3000);
                    }
                  }
                }}
                disabled={!canDiscard}
                className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold transition-all shadow-md flex items-center gap-1 cursor-pointer ${
                  isOverDiscardZone
                    ? 'bg-red-500 text-white ring-2 ring-red-300 scale-105 animate-pulse'
                    : canDiscard
                      ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse'
                      : 'bg-black/40 text-slate-500 border border-slate-700/50 disabled:opacity-50'
                }`}
                title="Taşı buraya sürükleyip atabilir veya seçili taşı atabilirsiniz"
              >
                <ArrowDown size={13} />
                <span>Taş At</span>
              </button>

              {/* Finish Hand Button */}
              <button
                type="button"
                onClick={handleDeclareFinish}
                disabled={!isMyTurn}
                className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[11px] sm:text-xs font-bold transition-colors cursor-pointer shadow-md disabled:opacity-50"
              >
                Bitir
              </button>
            </div>
          </div>

          {/* AHŞAP OKEY TAVLASI (ÇİFT KATLI ISTAKA) */}
          <div className="bg-gradient-to-b from-[#5c3a1e] via-[#432813] to-[#2c1708] border-2 border-[#8B5A2B] rounded-xl sm:rounded-2xl p-1 sm:p-1.5 shadow-[0_10px_25px_rgba(0,0,0,0.8),inset_0_2px_4px_rgba(255,255,255,0.15)] flex flex-col gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar touch-pan-x">
            {/* Üst Sıra (Slot 0 - 14) */}
            <div className="flex gap-0.5 sm:gap-1 md:gap-1.5 justify-center min-w-max mx-auto">
              {rack.slice(0, 15).map((tile, i) => {
                const slotIndex = i;
                const isSelected = selectedSlot === slotIndex;
                const isDraggingThis = draggedSlot === slotIndex || touchDragState?.slotIndex === slotIndex;
                return (
                  <div
                    key={slotIndex}
                    data-slot-index={slotIndex}
                    draggable={!!tile}
                    onDragStart={(e) => handleDragStart(e, slotIndex)}
                    onDragOver={handleDragOverSlot}
                    onDrop={(e) => handleDrop(e, slotIndex)}
                    onTouchStart={(e) => handleTouchStartSlot(e, slotIndex)}
                    onTouchMove={handleTouchMoveSlot}
                    onTouchEnd={handleTouchEndSlot}
                    onClick={() => handleSlotClick(slotIndex)}
                    className={`w-6.5 h-10 sm:w-8.5 sm:h-12.5 md:w-10 md:h-14 lg:w-11 lg:h-16 rounded-md sm:rounded-lg bg-[#1f1005] border flex items-center justify-center shrink-0 shadow-[inset_0_2px_4px_rgba(0,0,0,0.85)] cursor-pointer transition-all select-none ${
                      isDraggingThis
                        ? 'opacity-40 border-amber-400/50 scale-95'
                        : 'border-[#6b4221]/70 hover:border-amber-400/80 active:scale-95'
                    }`}
                  >
                    {tile && renderTileComponent(tile, isSelected, 'md')}
                  </div>
                );
              })}
            </div>

            {/* Alt Sıra (Slot 15 - 29) */}
            <div className="flex gap-0.5 sm:gap-1 md:gap-1.5 justify-center min-w-max mx-auto">
              {rack.slice(15, 30).map((tile, i) => {
                const slotIndex = i + 15;
                const isSelected = selectedSlot === slotIndex;
                const isDraggingThis = draggedSlot === slotIndex || touchDragState?.slotIndex === slotIndex;
                return (
                  <div
                    key={slotIndex}
                    data-slot-index={slotIndex}
                    draggable={!!tile}
                    onDragStart={(e) => handleDragStart(e, slotIndex)}
                    onDragOver={handleDragOverSlot}
                    onDrop={(e) => handleDrop(e, slotIndex)}
                    onTouchStart={(e) => handleTouchStartSlot(e, slotIndex)}
                    onTouchMove={handleTouchMoveSlot}
                    onTouchEnd={handleTouchEndSlot}
                    onClick={() => handleSlotClick(slotIndex)}
                    className={`w-6.5 h-10 sm:w-8.5 sm:h-12.5 md:w-10 md:h-14 lg:w-11 lg:h-16 rounded-md sm:rounded-lg bg-[#1f1005] border flex items-center justify-center shrink-0 shadow-[inset_0_2px_4px_rgba(0,0,0,0.85)] cursor-pointer transition-all select-none ${
                      isDraggingThis
                        ? 'opacity-40 border-amber-400/50 scale-95'
                        : 'border-[#6b4221]/70 hover:border-amber-400/80 active:scale-95'
                    }`}
                  >
                    {tile && renderTileComponent(tile, isSelected, 'md')}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* WINNER / GAME OVER MODAL */}
      {currentRoom.status === 'ended' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/50 rounded-3xl max-w-lg w-full p-6 text-center shadow-2xl">
            <Trophy size={56} className="text-amber-400 mx-auto mb-3 animate-bounce" />
            <h2 className="text-2xl font-black text-white">El Tamamlandı!</h2>
            <p className="text-amber-300 font-semibold mt-1 mb-4">{currentRoom.winningReason}</p>

            {/* Penalty & Scoreboard */}
            <div className="bg-slate-800/80 rounded-2xl p-4 text-left my-4 divide-y divide-slate-700">
              <h4 className="text-xs font-bold uppercase text-slate-400 pb-2">Ceza & Puan Durumu</h4>
              {currentRoom.players.map((p) => (
                <div key={p.id} className="py-2 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{p.username}</span>
                    {p.id === currentRoom.winnerId && <Crown size={14} className="text-amber-400" />}
                  </div>
                  <div className="text-right">
                    <span className={`font-mono font-bold ${p.id === currentRoom.winnerId ? 'text-emerald-400' : 'text-red-400'}`}>
                      {p.id === currentRoom.winnerId ? '-101' : `+${p.roundPenalty || 202}`} ceza
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-center gap-3 mt-4">
              <button
                onClick={handleLeaveRoom}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl transition-all"
              >
                Salona Dön
              </button>
              {currentRoom.hostId === currentUserId && (
                <button
                  onClick={handleStartGame}
                  className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow-lg transition-all"
                >
                  Yeni El Başlat
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Touch Drag Floating Tile (Parmağı takip eden taş) */}
      {touchDragState && touchDragState.isDragging && touchDragState.tile && (
        <div 
          className="fixed pointer-events-none z-50 transform -translate-x-1/2 -translate-y-1/2 scale-110 drop-shadow-2xl opacity-90 transition-opacity"
          style={{
            left: `${touchDragState.currentX}px`,
            top: `${touchDragState.currentY}px`
          }}
        >
          {renderTileComponent(touchDragState.tile, true, 'md')}
        </div>
      )}

    </div>
  );
}
