import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, RefreshCcw, LogOut, Plus, Play, 
  Trophy, Sparkles, AlertCircle, ArrowRight, RotateCw, 
  RotateCcw, Ban, ChevronLeft, Flame, Check, HelpCircle
} from 'lucide-react';
import { Socket } from 'socket.io-client';
import Avatar from './Avatar';
import { 
  UnoCard, 
  UnoRoomState, 
  UnoColor, 
  UnoValue, 
  isCardPlayable, 
  COLOR_STYLES 
} from '../utils/unoEngine';

interface UnoGameProps {
  socket: Socket | null;
  currentUserId: number;
  username: string;
  avatar?: string | null;
  color?: string | null;
  onBackToHub: () => void;
}

export default function UnoGame({ 
  socket, 
  currentUserId, 
  username, 
  avatar, 
  color,
  onBackToHub 
}: UnoGameProps) {
  const [rooms, setRooms] = useState<any[]>([]);
  const [currentRoom, setCurrentRoom] = useState<UnoRoomState | null>(null);
  const [hand, setHand] = useState<UnoCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [shakingCardId, setShakingCardId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newRoomName, setNewRoomName] = useState('UNO Eğlence Masası');
  
  // Wild color picker dialog
  const [pendingWildCardId, setPendingWildCardId] = useState<string | null>(null);

  // Messages
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Double click tracker for mobile/desktop
  const lastClickRef = useRef<{ cardId: string; time: number }>({ cardId: '', time: 0 });

  // Socket setup
  useEffect(() => {
    if (!socket) return;

    socket.emit("get_uno_rooms");
    socket.emit("get_my_uno_room");

    const onRoomsList = (list: any[]) => setRooms(list);
    const onRoomCreated = (roomId: string) => {
      socket.emit("uno_join_room", roomId);
    };
    const onRoomState = (state: UnoRoomState) => {
      setCurrentRoom(state);
      if (state.lastActionMessage) {
        setInfoMessage(state.lastActionMessage);
      }
    };
    const onHand = (cards: UnoCard[]) => {
      setHand(cards);
    };
    const onError = (msg: string) => {
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(null), 3000);
    };

    socket.on("uno_rooms_list", onRoomsList);
    socket.on("uno_room_created", onRoomCreated);
    socket.on("uno_state", onRoomState);
    socket.on("uno_hand", onHand);
    socket.on("uno_error", onError);

    return () => {
      socket.off("uno_rooms_list", onRoomsList);
      socket.off("uno_room_created", onRoomCreated);
      socket.off("uno_state", onRoomState);
      socket.off("uno_hand", onHand);
      socket.off("uno_error", onError);
    };
  }, [socket]);

  // Handle card click (tap once to select, double tap to play)
  const handleCardClick = (card: UnoCard) => {
    if (!currentRoom || currentRoom.status !== 'playing') return;
    const isMyTurn = currentRoom.players[currentRoom.currentTurn]?.id === currentUserId;

    const now = Date.now();
    const isDoubleClick = lastClickRef.current.cardId === card.id && (now - lastClickRef.current.time < 380);
    lastClickRef.current = { cardId: card.id, time: now };

    if (!isMyTurn) {
      setErrorMessage("Sıra sizde değil!");
      setTimeout(() => setErrorMessage(null), 2000);
      return;
    }

    const playable = isCardPlayable(card, currentRoom.topCard, currentRoom.activeColor);

    if (isDoubleClick || selectedCardId === card.id) {
      if (!playable) {
        triggerCardShake(card.id, "Bu kart şu an atılamaz! Renk veya sayı eşleşmeli.");
        return;
      }
      // Play card
      playCard(card);
    } else {
      // First tap: select card
      setSelectedCardId(card.id);
      if (!playable) {
        triggerCardShake(card.id, "Dikkat: Bu kart mevcut açık kartla eşleşmiyor.");
      }
    }
  };

  const triggerCardShake = (cardId: string, msg: string) => {
    setShakingCardId(cardId);
    setErrorMessage(msg);
    setTimeout(() => {
      setShakingCardId(null);
      setErrorMessage(null);
    }, 2200);
  };

  const playCard = (card: UnoCard, chosenColor?: UnoColor) => {
    if (!socket || !currentRoom) return;

    if ((card.color === 'wild' || card.value === 'wild' || card.value === 'wild4') && !chosenColor) {
      setPendingWildCardId(card.id);
      return;
    }

    socket.emit("uno_play_card", { cardId: card.id, chosenColor });
    setSelectedCardId(null);
    setPendingWildCardId(null);
  };

  const handleDrawCard = () => {
    if (!socket || !currentRoom || currentRoom.status !== 'playing') return;
    const isMyTurn = currentRoom.players[currentRoom.currentTurn]?.id === currentUserId;
    if (!isMyTurn) {
      setErrorMessage("Sıra sizde değil!");
      setTimeout(() => setErrorMessage(null), 2000);
      return;
    }
    socket.emit("uno_draw_card");
  };

  const handlePassTurn = () => {
    if (!socket || !currentRoom || currentRoom.status !== 'playing') return;
    socket.emit("uno_pass_turn");
  };

  const handleCallUno = () => {
    if (!socket || !currentRoom || currentRoom.status !== 'playing') return;
    socket.emit("uno_call_uno");
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket) return;
    socket.emit("uno_create_room", { name: newRoomName });
    setIsCreating(false);
  };

  const joinRoom = (roomId: string) => {
    if (!socket) return;
    socket.emit("uno_join_room", roomId);
  };

  const leaveRoom = () => {
    if (!socket) return;
    socket.emit("uno_leave_room");
    setCurrentRoom(null);
    setHand([]);
    setSelectedCardId(null);
  };

  const addBot = () => {
    if (!socket) return;
    socket.emit("uno_add_bot");
  };

  const removeBot = () => {
    if (!socket) return;
    socket.emit("uno_remove_bot");
  };

  const startGame = () => {
    if (!socket) return;
    socket.emit("uno_start_game");
  };

  const restartGame = () => {
    if (!socket) return;
    socket.emit("uno_restart_game");
  };

  // --- LOBBY VIEW ---
  if (!currentRoom) {
    return (
      <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 overflow-y-auto">
        <div className="max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div className="flex items-center gap-3">
              <button
                onClick={onBackToHub}
                className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition-colors flex items-center gap-1.5 text-xs font-semibold"
                title="Oyun Seçim Menüsüne Dön"
              >
                <ChevronLeft size={16} /> Oyun Seçimi
              </button>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-600 via-amber-500 to-sky-500 flex items-center justify-center shadow-lg font-black text-white text-lg tracking-wider transform -rotate-3">
                  U
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                    UNO Lobisi
                    <span className="text-[10px] uppercase font-bold tracking-widest bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full">
                      2-4 Oyuncu
                    </span>
                  </h1>
                  <p className="text-xs text-slate-400">Arkadaşlarınla veya akıllı botlarla canlı UNO oyna!</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => socket?.emit("get_uno_rooms")}
                className="p-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 transition-colors shadow-sm"
                title="Yenile"
              >
                <RefreshCcw size={18} />
              </button>
              <button 
                onClick={() => setIsCreating(true)}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-rose-900/30 flex items-center gap-2"
              >
                <Plus size={18} /> UNO Masası Kur
              </button>
            </div>
          </div>

          {/* Banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose-950/60 via-amber-950/40 to-sky-950/60 border border-rose-500/30 p-4 sm:p-5 shadow-xl">
            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1 max-w-xl">
                <span className="text-[11px] font-bold text-rose-400 flex items-center gap-1">
                  <Flame size={14} /> Resmi 108 Kartlık UNO Kuralları
                </span>
                <h3 className="font-extrabold text-base sm:text-lg text-white">
                  Özel Aksiyon Kartları & Parlayan "UNO!" Butonu
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  +2, +4 Joker, Renk Değiştir, Pas ve Yön Değiştirme kartlarıyla rakiplerini alt et. Son karta düştüğünde UNO butonuna basmayı unutma!
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                {['#dc2626', '#0284c7', '#16a34a', '#eab308'].map((c, i) => (
                  <div 
                    key={c}
                    className="w-8 h-12 rounded-lg border-2 border-white/80 shadow-md flex items-center justify-center font-black text-white text-xs transform"
                    style={{ backgroundColor: c, transform: `rotate(${(i - 1.5) * 8}deg)` }}
                  >
                    {i === 0 ? '+2' : i === 1 ? '⇄' : i === 2 ? '🚫' : '+4'}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Create Room Modal */}
          {isCreating && (
            <div className="bg-slate-900 p-5 rounded-2xl shadow-xl border border-rose-500/40 animate-in fade-in zoom-in-95">
              <h2 className="font-bold text-base md:text-lg mb-3 text-white flex items-center gap-2">
                <Sparkles className="text-amber-400" size={18} /> Yeni UNO Masası Kur
              </h2>
              <form onSubmit={handleCreateRoom} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-300">Masa Adı</label>
                  <input 
                    type="text" 
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    required
                    maxLength={30}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-rose-500 text-white placeholder-slate-500"
                    placeholder="UNO Masası"
                  />
                </div>
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
                  <p>• <strong>Kapasite:</strong> 2 ila 4 Kişilik (Boş yerlere istediğiniz an akıllı bot ekleyebilirsiniz).</p>
                  <p>• <strong>Deste:</strong> Standart 108 kart, her oyuncuya 7 kart dağıtılır.</p>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setIsCreating(false)} 
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                  >
                    İptal
                  </button>
                  <button 
                    type="submit" 
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-900/30"
                  >
                    Masayı Oluştur ve Gir
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Rooms Grid */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
              Aktif UNO Masaları ({rooms.length})
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {rooms.length === 0 ? (
                <div className="col-span-full py-16 text-center bg-slate-900/40 rounded-2xl border border-slate-800/60 p-6">
                  <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-500">
                    <Sparkles size={30} />
                  </div>
                  <p className="font-bold text-slate-200">Henüz açık bir UNO masası yok</p>
                  <p className="text-xs text-slate-400 mt-1 mb-4">Hemen bir masa kurup botlarla veya arkadaşlarınla eğlenceye başla!</p>
                  <button 
                    onClick={() => setIsCreating(true)}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition-colors inline-flex items-center gap-1.5 shadow"
                  >
                    <Plus size={16} /> İlk Masayı Kur
                  </button>
                </div>
              ) : (
                rooms.map((room) => (
                  <div 
                    key={room.id} 
                    className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 hover:border-rose-500/50 transition-all flex justify-between items-center shadow-sm"
                  >
                    <div className="space-y-1.5">
                      <h3 className="font-bold text-white text-sm sm:text-base truncate max-w-[180px]">{room.name}</h3>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="flex items-center gap-1 bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md text-[11px] font-medium">
                          <Users size={12}/> {room.players} / 4
                        </span>
                        <span className="bg-rose-950/60 text-rose-400 border border-rose-800/40 font-semibold px-2 py-0.5 rounded-md text-[11px]">
                          UNO
                        </span>
                        <span className={`px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                          room.status === 'playing' ? 'bg-amber-950/60 text-amber-400 border border-amber-800/40' : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                        }`}>
                          {room.status === 'playing' ? 'Oyun Sürüyor' : 'Bekleniyor'}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => joinRoom(room.id)}
                      disabled={room.players >= 4 && room.status !== 'playing'}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        room.players >= 4 && room.status !== 'playing' 
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                          : 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-900/20'
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
      </div>
    );
  }

  // --- TABLE VIEW (WAITING OR PLAYING) ---
  const myPlayerIdx = currentRoom.players.findIndex(p => p.id === currentUserId);
  const myPlayer = myPlayerIdx !== -1 ? currentRoom.players[myPlayerIdx] : null;
  const isHost = currentRoom.hostId === currentUserId;
  const isMyTurn = currentRoom.status === 'playing' && currentRoom.players[currentRoom.currentTurn]?.id === currentUserId;
  const currentTurnPlayer = currentRoom.players[currentRoom.currentTurn];

  return (
    <div 
      className="flex-1 flex flex-col bg-slate-950 text-slate-100 overflow-hidden relative select-none"
      style={{ touchAction: 'manipulation', overscrollBehavior: 'none' }}
    >
      
      {/* Toast Feedback */}
      {errorMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-rose-600 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 backdrop-blur-md animate-bounce border border-rose-400">
          <AlertCircle size={16} /> {errorMessage}
        </div>
      )}

      {/* Top Header Bar */}
      <div className="px-3 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0 z-20 backdrop-blur-md">
        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            onClick={leaveRoom}
            className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-slate-800 hover:bg-rose-950/60 hover:text-rose-400 text-slate-300 text-xs font-medium flex items-center gap-1 transition-colors border border-slate-700"
            title="Masadan Ayrıl"
          >
            <LogOut size={14} /> <span className="hidden sm:inline">Ayrıl</span>
          </button>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="font-bold text-xs sm:text-sm text-white truncate max-w-[120px] sm:max-w-[200px]">
                {currentRoom.name}
              </h2>
              <span className="text-[9px] sm:text-[10px] bg-rose-950/80 text-rose-300 border border-rose-800/60 px-1.5 py-0.2 rounded font-bold">
                UNO
              </span>
            </div>
            <p className="text-[10px] text-slate-400 flex items-center gap-1">
              <Users size={10} /> {currentRoom.players.length}/4 Oyuncu {currentRoom.status === 'playing' ? '• Canlı Oyun' : '• Hazırlık'}
            </p>
          </div>
        </div>

        {/* Direction & Active Color Indicators */}
        <div className="flex items-center gap-2">
          {currentRoom.status === 'playing' && (
            <>
              {/* Direction Indicator */}
              <div 
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-bold text-slate-300"
                title={`Oyun Yönü: ${currentRoom.direction === 1 ? 'Saat Yönü' : 'Ters Yön'}`}
              >
                {currentRoom.direction === 1 ? (
                  <RotateCw size={13} className="text-sky-400 animate-spin-slow" />
                ) : (
                  <RotateCcw size={13} className="text-amber-400 animate-spin-slow" />
                )}
                <span className="hidden xs:inline">
                  {currentRoom.direction === 1 ? 'Saat Yönü' : 'Ters Yön'}
                </span>
              </div>

              {/* Active Color Badge */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700">
                <div 
                  className={`w-3 h-3 rounded-full ${COLOR_STYLES[currentRoom.activeColor]?.bg || 'bg-slate-400'} shadow-sm ring-2 ${COLOR_STYLES[currentRoom.activeColor]?.ring || 'ring-white/20'}`} 
                />
                <span className="text-[11px] font-extrabold text-white">
                  {COLOR_STYLES[currentRoom.activeColor]?.label || 'Renk'}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* --- WAITING ROOM SCREEN --- */}
      {currentRoom.status === 'waiting' && (
        <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-y-auto bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
          <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
            
            <div className="text-center space-y-1.5">
              <div className="w-14 h-14 bg-gradient-to-tr from-rose-600 to-amber-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg text-white font-black text-2xl transform -rotate-3">
                U
              </div>
              <h2 className="text-lg font-black text-white">{currentRoom.name}</h2>
              <p className="text-xs text-slate-400">
                {currentRoom.players.length < 2 
                  ? 'Oyuna başlamak için en az 2 oyuncu veya bot gerekir' 
                  : 'Masa hazır! Yöneticinin oyunu başlatması bekleniyor'}
              </p>
            </div>

            {/* Players List (4 Seats) */}
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((slotIdx) => {
                const player = currentRoom.players[slotIdx];
                if (player) {
                  return (
                    <div 
                      key={player.id}
                      className={`p-3 rounded-2xl border flex items-center gap-2.5 transition-all ${
                        player.id === currentUserId 
                          ? 'bg-rose-950/30 border-rose-500/50' 
                          : 'bg-slate-950/80 border-slate-800'
                      }`}
                    >
                      <Avatar 
                        url={player.avatar || undefined} 
                        name={player.username} 
                        color={player.color || undefined} 
                        size={9} 
                      />
                      <div className="overflow-hidden flex-1">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-white truncate">{player.username}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px]">
                          {player.id === currentRoom.hostId && (
                            <span className="text-amber-400 font-semibold">★ Yönetici</span>
                          )}
                          {player.isBot && (
                            <span className="text-indigo-400 font-semibold">🤖 Bot</span>
                          )}
                          {player.id === currentUserId && (
                            <span className="text-emerald-400 font-semibold">(Sen)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div 
                      key={slotIdx}
                      className="p-3 rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 flex flex-col items-center justify-center text-center gap-1 min-h-[64px]"
                    >
                      <span className="text-[11px] text-slate-500 font-medium">Boş Koltuk</span>
                      {isHost && (
                        <button
                          onClick={addBot}
                          className="px-2 py-1 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-lg text-[10px] font-bold transition-colors"
                        >
                          + Bot Ekle
                        </button>
                      )}
                    </div>
                  );
                }
              })}
            </div>

            {/* Host Management Buttons */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              {isHost ? (
                <>
                  <div className="flex gap-2">
                    {currentRoom.players.length < 4 && (
                      <button
                        onClick={addBot}
                        className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold text-xs rounded-xl transition-colors border border-indigo-500/30 flex items-center justify-center gap-1"
                      >
                        🤖 Bot Ekle
                      </button>
                    )}
                    {currentRoom.players.some(p => p.isBot) && (
                      <button
                        onClick={removeBot}
                        className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-rose-300 font-bold text-xs rounded-xl transition-colors border border-rose-500/30"
                      >
                        Bot Çıkar
                      </button>
                    )}
                  </div>

                  <button
                    onClick={startGame}
                    disabled={currentRoom.players.length < 2}
                    className={`w-full py-3 rounded-xl font-black text-sm transition-all shadow-lg flex items-center justify-center gap-2 ${
                      currentRoom.players.length >= 2 
                        ? 'bg-gradient-to-r from-rose-600 to-amber-500 text-white shadow-rose-900/40 hover:scale-[1.02]' 
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <Play size={16} /> Oyunu Başlat ({currentRoom.players.length}/4)
                  </button>
                </>
              ) : (
                <div className="text-center py-2 text-xs text-slate-400 font-medium animate-pulse">
                  Masa yöneticisinin oyunu başlatması bekleniyor...
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* --- PLAYING TABLE SURFACE (MOBILE-FIRST) --- */}
      {currentRoom.status === 'playing' && (
        <div 
          className="flex-1 relative flex flex-col justify-between p-2 sm:p-4 overflow-hidden bg-[radial-gradient(ellipse_at_center,#1e1b4b_0%,#0f172a_60%,#020617_100%)] shadow-inner"
          style={{ overscrollBehavior: 'none' }}
        >
          
          {/* Action Ticker Banner */}
          <div className="w-full flex justify-center z-10">
            <div className={`px-4 py-1.5 rounded-full text-xs font-bold shadow-lg backdrop-blur-md flex items-center gap-2 transition-all ${
              isMyTurn 
                ? 'bg-gradient-to-r from-amber-500 to-rose-600 text-slate-950 ring-2 ring-amber-300 animate-pulse' 
                : 'bg-slate-900/90 text-slate-300 border border-slate-700'
            }`}>
              {isMyTurn ? (
                <span>🔥 <strong>Sıra Sende!</strong> Kartını oyna veya desteden çek.</span>
              ) : (
                <span>Sıra: <strong>{currentTurnPlayer?.username}</strong> {currentTurnPlayer?.isBot ? '(Düşünüyor...)' : ''}</span>
              )}
            </div>
          </div>

          {/* Opponent Seats (Arranged cleanly around the top/sides) */}
          <div className="w-full max-w-2xl mx-auto flex items-center justify-around z-10 py-1">
            {currentRoom.players.filter(p => p.id !== currentUserId).map((opponent) => {
              const isHisTurn = currentRoom.players[currentRoom.currentTurn]?.id === opponent.id;
              const hasUnoAlert = opponent.cardCount === 1;

              return (
                <div 
                  key={opponent.id} 
                  className={`flex flex-col items-center gap-1 transition-all ${
                    isHisTurn ? 'scale-105' : 'opacity-85'
                  }`}
                >
                  <div className="relative">
                    <div className={`p-0.5 rounded-full transition-all ${
                      isHisTurn ? 'ring-4 ring-amber-400 shadow-lg shadow-amber-500/40' : ''
                    }`}>
                      <Avatar 
                        url={opponent.avatar || undefined} 
                        name={opponent.username} 
                        color={opponent.color || undefined} 
                        size={9} 
                      />
                    </div>
                    {/* Card Count Pill */}
                    <div className="absolute -bottom-1 -right-2 bg-slate-900 border border-slate-700 text-white font-extrabold text-[10px] px-1.5 py-0.2 rounded-full shadow flex items-center gap-0.5">
                      🎴 {opponent.cardCount}
                    </div>
                    {/* UNO alert badge */}
                    {hasUnoAlert && (
                      <div className="absolute -top-2 -right-3 bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full shadow-lg border border-white animate-bounce">
                        UNO!
                      </div>
                    )}
                  </div>

                  <span className="text-[11px] font-semibold text-slate-300 truncate max-w-[80px]">
                    {opponent.username}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Center Discard Pile & Draw Pile Area */}
          <div className="flex-1 flex items-center justify-center gap-6 sm:gap-10 my-auto z-10">
            
            {/* Draw Pile (Kapalı Deste) */}
            <div 
              onClick={handleDrawCard}
              className={`flex flex-col items-center gap-2 cursor-pointer transition-transform ${
                isMyTurn ? 'hover:scale-105 active:scale-95' : 'opacity-80'
              }`}
              title="Desteden Kart Çek"
            >
              <div className="relative w-20 h-28 sm:w-24 sm:h-34 rounded-2xl bg-gradient-to-br from-slate-900 via-rose-950 to-slate-900 border-2 border-rose-500/60 shadow-2xl flex items-center justify-center overflow-hidden">
                {/* Deck Layer Stack Effect */}
                <div className="absolute -top-1 -left-1 w-full h-full rounded-2xl border border-slate-700 pointer-events-none" />
                <div className="w-12 h-16 rounded-xl border border-white/20 bg-slate-950/80 flex flex-col items-center justify-center text-center">
                  <span className="text-xs font-black text-rose-500 tracking-wider">UNO</span>
                  <span className="text-[10px] font-bold text-slate-400">{currentRoom.deckCount}</span>
                </div>
              </div>
              <span className="text-[11px] font-bold text-slate-300 bg-slate-900/80 px-2 py-0.5 rounded-full border border-slate-700">
                Kart Çek
              </span>
            </div>

            {/* Discard Pile (Ortadaki Açık Kart) */}
            <div 
              onClick={() => {
                if (selectedCardId && isMyTurn) {
                  const card = hand.find(c => c.id === selectedCardId);
                  if (card) {
                    if (isCardPlayable(card, currentRoom.topCard, currentRoom.activeColor)) {
                      playCard(card);
                    } else {
                      triggerCardShake(card.id, "Bu kart atılamaz! Renk veya sayı eşleşmeli.");
                    }
                  }
                }
              }}
              className="flex flex-col items-center gap-2"
              title="Açık Deste (Seçili kartı buraya dokunarak atabilirsin)"
            >
              {currentRoom.topCard ? (
                <div className="relative transform hover:scale-105 transition-transform">
                  <UnoCardView 
                    card={currentRoom.topCard} 
                    size="large"
                    activeColor={currentRoom.activeColor}
                  />
                </div>
              ) : (
                <div className="w-20 h-28 sm:w-24 sm:h-34 rounded-2xl border-2 border-dashed border-slate-700 flex items-center justify-center text-xs text-slate-500">
                  Boş
                </div>
              )}
              <span className="text-[11px] font-extrabold text-white bg-slate-900/80 px-2 py-0.5 rounded-full border border-slate-700">
                Son Kart
              </span>
            </div>

          </div>

          {/* Action Toolbar & UNO Call Button */}
          <div className="w-full max-w-2xl mx-auto flex items-center justify-between gap-2 px-1 z-20">
            
            {/* Left side actions */}
            <div className="flex items-center gap-1.5">
              {isMyTurn && (
                <button
                  onClick={handlePassTurn}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors border border-slate-700 shadow"
                  title="Kart çektikten sonra pas geç"
                >
                  Pas Geç
                </button>
              )}

              {selectedCardId && isMyTurn && (
                <button
                  onClick={() => {
                    const card = hand.find(c => c.id === selectedCardId);
                    if (card) {
                      if (isCardPlayable(card, currentRoom.topCard, currentRoom.activeColor)) {
                        playCard(card);
                      } else {
                        triggerCardShake(card.id, "Bu kart atılamaz! Renk veya sayı eşleşmeli.");
                      }
                    }
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-lg transition-transform active:scale-95 flex items-center gap-1 animate-pulse"
                >
                  <Check size={14} /> Kartı Oyna
                </button>
              )}
            </div>

            {/* Glowing UNO Button */}
            <button
              onClick={handleCallUno}
              className={`px-4 sm:px-6 py-2 rounded-2xl font-black text-xs sm:text-sm tracking-wider uppercase transition-all shadow-xl flex items-center gap-1.5 transform active:scale-90 ${
                myPlayer?.hasCalledUno
                  ? 'bg-emerald-600 text-white ring-2 ring-emerald-400 cursor-default'
                  : hand.length <= 2 
                    ? 'bg-gradient-to-r from-rose-600 via-amber-500 to-rose-600 text-white ring-4 ring-amber-400 shadow-rose-900/60 animate-bounce' 
                    : 'bg-slate-800 hover:bg-rose-900/60 text-slate-300 border border-slate-700'
              }`}
            >
              <Flame size={18} className={myPlayer?.hasCalledUno ? 'text-white' : 'text-amber-300 animate-pulse'} />
              {myPlayer?.hasCalledUno ? 'UNO Dedin! ✅' : 'UNO!'}
            </button>
          </div>

          {/* Player Hand (Cards at bottom, Horizontally scrollable & touch-optimized) */}
          <div className="w-full max-w-4xl mx-auto z-20 pt-2 pb-1">
            <div className="flex items-center justify-between px-2 mb-1 text-[11px] font-bold text-slate-400">
              <span>Eliniz ({hand.length} Kart):</span>
              <span className="text-[10px] text-slate-400 hidden sm:inline">
                Seçmek için bir kez dokun, oynamak için açık desteye dokun veya çift tıkla
              </span>
            </div>

            {/* Card Ribbon / Fan */}
            <div 
              className="flex items-end gap-1 sm:gap-2 px-2 py-3 overflow-x-auto no-scrollbar scroll-smooth"
              style={{ touchAction: 'pan-x' }}
            >
              {hand.map((card) => {
                const isSelected = selectedCardId === card.id;
                const isPlayable = isMyTurn && isCardPlayable(card, currentRoom.topCard, currentRoom.activeColor);
                const isShaking = shakingCardId === card.id;

                return (
                  <div
                    key={card.id}
                    onClick={() => handleCardClick(card)}
                    className={`cursor-pointer transition-all duration-200 shrink-0 transform ${
                      isSelected ? '-translate-y-4 scale-105 z-30' : 'hover:-translate-y-2'
                    } ${isShaking ? 'animate-shake' : ''}`}
                  >
                    <UnoCardView 
                      card={card} 
                      size="medium"
                      isSelected={isSelected}
                      isPlayable={isPlayable}
                    />
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* --- WILD COLOR PICKER MODAL --- */}
      {pendingWildCardId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
            <h3 className="text-lg font-black text-white">Yeni Rengi Seçin</h3>
            <p className="text-xs text-slate-400">Joker kart oynandı. Oyunun devam edeceği rengi belirleyin:</p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              {[
                { color: 'red', label: 'Kırmızı', bg: 'bg-rose-600 hover:bg-rose-500' },
                { color: 'blue', label: 'Mavi', bg: 'bg-sky-600 hover:bg-sky-500' },
                { color: 'green', label: 'Yeşil', bg: 'bg-emerald-600 hover:bg-emerald-500' },
                { color: 'yellow', label: 'Sarı', bg: 'bg-amber-400 hover:bg-amber-300 text-slate-950 font-black' }
              ].map(item => (
                <button
                  key={item.color}
                  onClick={() => {
                    const card = hand.find(c => c.id === pendingWildCardId);
                    if (card) {
                      playCard(card, item.color as UnoColor);
                    }
                  }}
                  className={`py-4 rounded-2xl text-white font-extrabold text-sm transition-transform active:scale-95 shadow-lg ${item.bg}`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setPendingWildCardId(null)}
              className="mt-2 text-xs text-slate-400 hover:text-white"
            >
              İptal
            </button>
          </div>
        </div>
      )}

      {/* --- GAME OVER WINNER MODAL --- */}
      {currentRoom.status === 'ended' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-amber-500/60 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-5">
            
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center mx-auto shadow-2xl shadow-amber-500/30">
              <Trophy size={40} className="text-white animate-bounce" />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-black text-white">Oyun Bitti!</h2>
              <p className="text-sm font-bold text-amber-400">
                {currentRoom.players.find(p => p.id === currentRoom.winnerId)?.username || 'Bir oyuncu'} kazandı! 🏆
              </p>
            </div>

            <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 text-xs text-slate-300">
              {currentRoom.lastActionMessage}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={leaveRoom}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
              >
                Masadan Ayrıl
              </button>

              {isHost && (
                <button
                  onClick={restartGame}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-500 text-white font-black text-xs transition-transform active:scale-95 shadow-lg shadow-rose-900/30"
                >
                  Yeni Tur Başlat
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Sub-component to render a single UNO Card
function UnoCardView({ 
  card, 
  size = 'medium',
  isSelected = false,
  isPlayable = false,
  activeColor
}: { 
  card: UnoCard; 
  size?: 'small' | 'medium' | 'large';
  isSelected?: boolean;
  isPlayable?: boolean;
  activeColor?: UnoColor;
}) {
  const isWild = card.color === 'wild' || card.value === 'wild' || card.value === 'wild4';

  const colorMap: Record<string, { bg: string; border: string; text: string }> = {
    red: { bg: 'bg-rose-600', border: 'border-rose-400', text: 'text-white' },
    blue: { bg: 'bg-sky-600', border: 'border-sky-400', text: 'text-white' },
    green: { bg: 'bg-emerald-600', border: 'border-emerald-400', text: 'text-white' },
    yellow: { bg: 'bg-amber-400', border: 'border-amber-200', text: 'text-slate-950' }
  };

  const colorStyle = isWild 
    ? {
        bg: 'bg-gradient-to-br from-rose-600 via-amber-400 to-sky-600',
        border: 'border-white',
        text: 'text-white'
      }
    : (colorMap[card.color] || { bg: 'bg-slate-700', border: 'border-slate-500', text: 'text-white' });

  // Determine display label & icon
  let displayValue: React.ReactNode = card.value;
  if (card.value === 'draw2') displayValue = '+2';
  else if (card.value === 'reverse') displayValue = '⇄';
  else if (card.value === 'skip') displayValue = '🚫';
  else if (card.value === 'wild') displayValue = '★';
  else if (card.value === 'wild4') displayValue = '+4';

  const dimensions = size === 'large' 
    ? 'w-24 h-36 sm:w-28 sm:h-42 rounded-2xl text-2xl'
    : size === 'medium'
      ? 'w-16 h-24 sm:w-20 sm:h-30 rounded-xl text-lg'
      : 'w-12 h-18 rounded-lg text-sm';

  return (
    <div 
      className={`relative ${dimensions} ${colorStyle.bg} border-2 ${colorStyle.border} shadow-xl select-none flex flex-col justify-between p-1.5 sm:p-2 overflow-hidden ${
        isSelected ? 'ring-4 ring-white shadow-2xl' : ''
      } ${isPlayable ? 'ring-2 ring-emerald-400/80' : ''}`}
    >
      {/* Top Left pip */}
      <div className={`text-[10px] sm:text-xs font-black leading-none ${colorStyle.text}`}>
        {displayValue}
      </div>

      {/* Center White Oval with Big Value */}
      <div className="relative my-auto mx-auto w-[82%] h-[68%] rounded-[50%] bg-white/95 shadow-inner flex items-center justify-center transform -rotate-12">
        <span className={`font-black ${isWild ? 'text-slate-950' : card.color === 'yellow' ? 'text-amber-500' : card.color === 'red' ? 'text-rose-600' : card.color === 'blue' ? 'text-sky-600' : 'text-emerald-600'} text-base sm:text-2xl tracking-tighter`}>
          {displayValue}
        </span>
      </div>

      {/* Bottom Right pip (Rotated) */}
      <div className={`text-[10px] sm:text-xs font-black leading-none ${colorStyle.text} text-right transform rotate-180`}>
        {displayValue}
      </div>

      {/* Active color pip indicator on top card if Wild was played */}
      {isWild && activeColor && size === 'large' && (
        <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full border border-white shadow" style={{
          backgroundColor: activeColor === 'red' ? '#dc2626' : activeColor === 'blue' ? '#0284c7' : activeColor === 'green' ? '#16a34a' : '#eab308'
        }} />
      )}
    </div>
  );
}
