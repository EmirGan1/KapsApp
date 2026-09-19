import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Palette, 
  Eraser, 
  Trash2, 
  Send, 
  Users, 
  Crown, 
  Play, 
  RotateCcw, 
  LogOut, 
  Sparkles, 
  Trophy, 
  UserMinus, 
  Pencil, 
  CheckCircle2, 
  Clock, 
  Search, 
  Plus, 
  HelpCircle,
  Volume2
} from 'lucide-react';
import { Socket } from 'socket.io-client';
import Avatar from './Avatar';
import { DrawGuessRoom, DrawGuessPlayer, DrawGuessChatMessage, DrawLineData } from '../types';

interface DrawGuessGameProps {
  socket: Socket | null;
  currentUserId: number;
  username: string;
  avatar?: string | null;
  color?: string | null;
  onBackToHub: () => void;
}

const COLOR_PALETTE = [
  '#000000', // Siyah
  '#ffffff', // Beyaz
  '#ef4444', // Kırmızı
  '#3b82f6', // Mavi
  '#10b981', // Yeşil
  '#eab308', // Sarı
  '#f97316', // Turuncu
  '#8b5cf6', // Mor
  '#ec4899', // Pembe
  '#78350f', // Kahverengi
  '#06b6d4', // Camgöbeği
  '#64748b'  // Gri
];

const BRUSH_SIZES = [
  { size: 3, label: 'İnce' },
  { size: 6, label: 'Orta' },
  { size: 12, label: 'Kalın' },
  { size: 22, label: 'Dev' }
];

export default function DrawGuessGame({
  socket,
  currentUserId,
  username,
  avatar,
  color,
  onBackToHub
}: DrawGuessGameProps) {
  // Lobby states
  const [rooms, setRooms] = useState<DrawGuessRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<DrawGuessRoom | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createRoomName, setCreateRoomName] = useState(`${username}'in Çizim Odası`);
  const [createMaxPlayers, setCreateMaxPlayers] = useState(6);
  const [createRounds, setCreateRounds] = useState(3);
  const [createError, setCreateError] = useState('');

  // Game Arena states
  const [chatMessages, setChatMessages] = useState<DrawGuessChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [selectedColor, setSelectedColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(6);
  const [isEraser, setIsEraser] = useState(false);

  // Canvas Drawing refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Check if current user is drawing
  const isDrawer = activeRoom?.drawerId === currentUserId && activeRoom?.status === 'drawing';
  const isHost = activeRoom?.hostId === currentUserId;
  const isChoosing = activeRoom?.drawerId === currentUserId && activeRoom?.status === 'choosing';

  // --- SOCKET LISTENERS ---
  useEffect(() => {
    if (!socket) return;

    const handleRoomsList = (roomsList: DrawGuessRoom[]) => {
      setRooms(roomsList || []);
    };

    const handleRoomUpdated = (room: DrawGuessRoom) => {
      setActiveRoom(room);
    };

    const handleRoomClosed = (data: { reason: string }) => {
      alert(data.reason || 'Oda kapatıldı.');
      setActiveRoom(null);
      setChatMessages([]);
    };

    const handleKicked = (data: { reason: string }) => {
      alert(data.reason || 'Odadan çıkarıldınız.');
      setActiveRoom(null);
      setChatMessages([]);
    };

    const handleDrawLine = (line: DrawLineData) => {
      renderLineOnCanvas(line);
    };

    const handleCanvasCleared = () => {
      clearCanvasLocally();
    };

    const handleChatMessage = (msg: DrawGuessChatMessage) => {
      setChatMessages(prev => [...prev, msg]);
    };

    const handleChatHistory = (msgs: DrawGuessChatMessage[]) => {
      setChatMessages(msgs || []);
    };

    const handleTimer = (data: { timer: number }) => {
      setActiveRoom(prev => prev ? { ...prev, timer: data.timer } : null);
    };

    socket.on('drawguess_rooms_list', handleRoomsList);
    socket.on('drawguess_room_updated', handleRoomUpdated);
    socket.on('drawguess_room_closed', handleRoomClosed);
    socket.on('drawguess_kicked', handleKicked);
    socket.on('drawguess_draw_line', handleDrawLine);
    socket.on('drawguess_canvas_cleared', handleCanvasCleared);
    socket.on('drawguess_chat_message', handleChatMessage);
    socket.on('drawguess_chat_history', handleChatHistory);
    socket.on('drawguess_timer', handleTimer);

    // Initial fetch
    socket.emit('get_drawguess_rooms');
    socket.emit('get_my_drawguess_room', (res: any) => {
      if (res && res.success && res.room) {
        setActiveRoom(res.room);
      }
    });

    return () => {
      socket.off('drawguess_rooms_list', handleRoomsList);
      socket.off('drawguess_room_updated', handleRoomUpdated);
      socket.off('drawguess_room_closed', handleRoomClosed);
      socket.off('drawguess_kicked', handleKicked);
      socket.off('drawguess_draw_line', handleDrawLine);
      socket.off('drawguess_canvas_cleared', handleCanvasCleared);
      socket.off('drawguess_chat_message', handleChatMessage);
      socket.off('drawguess_chat_history', handleChatHistory);
      socket.off('drawguess_timer', handleTimer);
    };
  }, [socket]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // --- CANVAS RESIZE & DRAWING HELPERS ---
  const clearCanvasLocally = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const renderLineOnCanvas = useCallback((line: DrawLineData) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const x0 = line.x0 * canvas.width;
    const y0 = line.y0 * canvas.height;
    const x1 = line.x1 * canvas.width;
    const y1 = line.y1 * canvas.height;
    const lineThickness = (line.size / 600) * canvas.width;

    ctx.save();
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = line.isEraser ? '#ffffff' : line.color;
    ctx.lineWidth = Math.max(2, lineThickness);
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.restore();
  }, []);

  // When room changes or new round starts, clear local canvas
  useEffect(() => {
    if (activeRoom?.status === 'choosing' || activeRoom?.status === 'lobby') {
      clearCanvasLocally();
    }
  }, [activeRoom?.status, activeRoom?.currentRound]);

  // Handle Canvas Setup with high DPI
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      
      // Keep backing store resolution fixed at 800x500 for crisp uniform drawings
      if (canvas.width !== 800 || canvas.height !== 500) {
        canvas.width = 800;
        canvas.height = 500;
        clearCanvasLocally();
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [activeRoom]);

  // Canvas Coordinate Extractors
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const relX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const relY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    return { x: relX, y: relY };
  };

  const handleStartDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawer) return;
    if ('touches' in e && e.cancelable) e.preventDefault();

    const coords = getCanvasCoords(e);
    if (!coords) return;

    isDrawingRef.current = true;
    lastPosRef.current = coords;

    // Draw a single dot
    const lineData: DrawLineData = {
      x0: coords.x,
      y0: coords.y,
      x1: coords.x,
      y1: coords.y,
      color: selectedColor,
      size: brushSize,
      isEraser
    };

    renderLineOnCanvas(lineData);
    if (socket && activeRoom) {
      socket.emit('drawguess_draw_line', { roomId: activeRoom.id, line: lineData });
    }
  };

  const handleMoveDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawer || !isDrawingRef.current) return;
    if ('touches' in e && e.cancelable) e.preventDefault();

    const coords = getCanvasCoords(e);
    if (!coords || !lastPosRef.current) return;

    const lineData: DrawLineData = {
      x0: lastPosRef.current.x,
      y0: lastPosRef.current.y,
      x1: coords.x,
      y1: coords.y,
      color: selectedColor,
      size: brushSize,
      isEraser
    };

    renderLineOnCanvas(lineData);
    if (socket && activeRoom) {
      socket.emit('drawguess_draw_line', { roomId: activeRoom.id, line: lineData });
    }

    lastPosRef.current = coords;
  };

  const handleEndDraw = () => {
    isDrawingRef.current = false;
    lastPosRef.current = null;
  };

  const handleClearCanvasClick = () => {
    if (!isDrawer || !socket || !activeRoom) return;
    clearCanvasLocally();
    socket.emit('drawguess_clear_canvas', { roomId: activeRoom.id });
  };

  // --- ACTIONS ---
  const handleCreateRoom = () => {
    if (!socket) return;
    if (!createRoomName.trim()) {
      setCreateError('Lütfen bir oda adı girin.');
      return;
    }

    socket.emit(
      'create_drawguess_room',
      {
        name: createRoomName.trim(),
        maxPlayers: Number(createMaxPlayers),
        totalRounds: Number(createRounds)
      },
      (res: any) => {
        if (res && res.success) {
          setShowCreateModal(false);
          setCreateError('');
          setActiveRoom(res.room);
        } else {
          setCreateError(res?.message || 'Oda oluşturulamadı.');
        }
      }
    );
  };

  const handleJoinRoom = (roomId: string) => {
    if (!socket) return;
    socket.emit('join_drawguess_room', { roomId }, (res: any) => {
      if (res && res.success) {
        setActiveRoom(res.room);
      } else {
        alert(res?.message || 'Odaya katılınamadı.');
      }
    });
  };

  const handleLeaveRoom = () => {
    if (!socket || !activeRoom) return;
    if (confirm('Odadan ayrılmak istediğinize emin misiniz?')) {
      socket.emit('leave_drawguess_room');
      setActiveRoom(null);
      setChatMessages([]);
    }
  };

  const handleStartGame = () => {
    if (!socket || !activeRoom) return;
    if (activeRoom.players.length < 2) {
      alert('Oyunu başlatmak için en az 2 oyuncu gereklidir.');
      return;
    }
    socket.emit('start_drawguess_game', { roomId: activeRoom.id });
  };

  const handleKickPlayer = (targetUserId: number) => {
    if (!socket || !activeRoom) return;
    if (confirm('Bu oyuncuyu odadan atmak istediğinize emin misiniz?')) {
      socket.emit('drawguess_kick_player', { roomId: activeRoom.id, targetUserId });
    }
  };

  const handleSelectWord = (word: string) => {
    if (!socket || !activeRoom) return;
    socket.emit('drawguess_select_word', { roomId: activeRoom.id, word });
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !activeRoom || !chatInput.trim()) return;

    socket.emit('drawguess_chat_message', {
      roomId: activeRoom.id,
      text: chatInput.trim()
    });
    setChatInput('');
  };

  const handleRestartGame = () => {
    if (!socket || !activeRoom || !isHost) return;
    socket.emit('start_drawguess_game', { roomId: activeRoom.id });
  };

  // Filter rooms
  const filteredRooms = rooms.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.hostUsername.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ==========================================
  // VIEW 1: LOBBY & ROOM LIST
  // ==========================================
  if (!activeRoom) {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 transition-colors">
        <div className="max-w-5xl mx-auto space-y-6">
          
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
            <div>
              <button
                onClick={onBackToHub}
                className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 flex items-center gap-1 mb-2 cursor-pointer transition-colors"
              >
                ← Oyun Salonu'na Dön
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
                  <Palette size={26} />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
                    Çiz & Tahmin Et <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-800">Gartic Modu</span>
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    Sırayla çiz, arkadaşların tahmin etsin; en hızlı bilen puanları kapsın!
                  </p>
                </div>
              </div>
            </div>

            {/* Create Room Button */}
            <button
              onClick={() => {
                setCreateRoomName(`${username}'in Çizim Odası`);
                setShowCreateModal(true);
              }}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-md shadow-purple-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all transform hover:-translate-y-0.5"
            >
              <Plus size={18} /> Oda Kur
            </button>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Oda veya kurucu ara..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {rooms.length} Aktif Oda
            </div>
          </div>

          {/* Rooms Grid */}
          {filteredRooms.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-purple-500/10 text-purple-500 flex items-center justify-center mx-auto text-2xl">
                🎨
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Henüz açık çizim odası bulunmuyor
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                İlk odayı hemen kur, arkadaşlarını davet et ve çizmeye başla!
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow cursor-pointer transition-colors"
              >
                Hemen Oda Oluştur
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRooms.map(r => {
                const isFull = r.players.length >= r.maxPlayers;
                const isPlaying = r.status !== 'lobby';

                return (
                  <div
                    key={r.id}
                    className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500 dark:hover:border-purple-500 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm truncate">
                          {r.name}
                        </h3>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider shrink-0 ${
                            isPlaying
                              ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400'
                              : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {isPlaying ? 'Oynanıyor' : 'Lobide'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <Crown size={12} className="text-amber-500" />
                        <span className="truncate">Kurucu: <strong>{r.hostUsername}</strong></span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Users size={14} className="text-purple-500" />
                          <span>{r.players.length} / {r.maxPlayers} Oyuncu</span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {r.totalRounds} Tur
                        </div>
                      </div>

                      <button
                        disabled={isFull}
                        onClick={() => handleJoinRoom(r.id)}
                        className={`px-4 py-2 rounded-xl font-bold text-xs cursor-pointer transition-all ${
                          isFull
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                            : 'bg-purple-600 hover:bg-purple-500 text-white shadow-sm'
                        }`}
                      >
                        {isFull ? 'Dolu' : 'Katıl'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick Rules Banner */}
          <div className="rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50 p-4 sm:p-5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
              <HelpCircle size={18} />
            </div>
            <div className="text-xs text-indigo-900 dark:text-indigo-200 space-y-1">
              <div className="font-bold">Nasıl Oynanır?</div>
              <p className="text-indigo-800/80 dark:text-indigo-300/80 leading-relaxed">
                Her tur bir oyuncu gizli kelimeler arasından seçim yaparak ekrana çizer. Diğer oyuncular sağdaki sohbet kutusuna tahminlerini yazar. Doğru bilen oyuncunun cevabı gizlenir, yeşil bildirimle puan eklenir! Süre ne kadar erken ise kazanılan puan o kadar yüksektir.
              </p>
            </div>
          </div>

        </div>

        {/* CREATE ROOM MODAL */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 space-y-5 animate-in fade-in zoom-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                    <Palette size={20} />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                    Yeni Çizim Odası Kur
                  </h3>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold cursor-pointer"
                >
                  ×
                </button>
              </div>

              {createError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold">
                  {createError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Oda Adı
                  </label>
                  <input
                    type="text"
                    value={createRoomName}
                    onChange={e => setCreateRoomName(e.target.value)}
                    maxLength={30}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Maksimum Oyuncu Sayısı ({createMaxPlayers} Kişi)
                  </label>
                  <input
                    type="range"
                    min={2}
                    max={10}
                    value={createMaxPlayers}
                    onChange={e => setCreateMaxPlayers(Number(e.target.value))}
                    className="w-full accent-purple-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                    <span>2 Oyuncu</span>
                    <span>6 Oyuncu</span>
                    <span>10 Oyuncu</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Tur Sayısı ({createRounds} Tur)
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[2, 3, 4, 5].map(rounds => (
                      <button
                        key={rounds}
                        type="button"
                        onClick={() => setCreateRounds(rounds)}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          createRounds === rounds
                            ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-purple-400'
                        }`}
                      >
                        {rounds} Tur
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer transition-colors"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={handleCreateRoom}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md cursor-pointer transition-all"
                >
                  Odayı Başlat
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW 2: ACTIVE GAME ARENA
  // ==========================================
  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900 text-slate-100 overflow-hidden select-none">
      
      {/* 1. TOP HEADER & WORD DISPLAY */}
      <div className="bg-slate-950/80 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between gap-3 shrink-0">
        
        {/* Left: Leave / Room Info */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleLeaveRoom}
            className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600/80 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Odadan Ayrıl"
          >
            <LogOut size={16} />
          </button>
          <div>
            <h2 className="font-black text-sm text-slate-100 leading-tight truncate max-w-[150px] sm:max-w-xs">
              {activeRoom.name}
            </h2>
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span>Tur: <strong>{activeRoom.currentRound} / {activeRoom.totalRounds}</strong></span>
              <span>•</span>
              <span className="capitalize">{activeRoom.status === 'lobby' ? 'Lobide' : activeRoom.status === 'choosing' ? 'Kelime Seçiliyor' : activeRoom.status === 'drawing' ? 'Çizim Yapılıyor' : activeRoom.status === 'round_end' ? 'Tur Sonu' : 'Oyun Bitti'}</span>
            </div>
          </div>
        </div>

        {/* Center: Secret Word or Mask */}
        <div className="flex-1 flex items-center justify-center text-center px-2">
          {activeRoom.status === 'lobby' ? (
            <div className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold">
              🎮 Oyuncuların toplanması bekleniyor
            </div>
          ) : activeRoom.status === 'choosing' ? (
            <div className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold animate-pulse flex items-center gap-2">
              <Pencil size={14} />
              <span>{isChoosing ? 'Kelime seçin!' : `${activeRoom.drawerUsername} kelime seçiyor...`}</span>
            </div>
          ) : activeRoom.status === 'drawing' ? (
            <div className="flex flex-col items-center">
              {isDrawer ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-purple-400 font-bold uppercase tracking-wider">ÇİZDİĞİNİZ KELİME:</span>
                  <span className="text-base sm:text-lg font-black text-emerald-400 bg-emerald-950/60 px-3 py-0.5 rounded-lg border border-emerald-500/40 tracking-wider">
                    {activeRoom.currentWord}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-sm sm:text-lg font-mono font-black text-amber-300 tracking-[0.35em] bg-slate-900/90 px-4 py-1 rounded-xl border border-amber-500/30 shadow-inner">
                    {activeRoom.wordMask || '_ _ _ _'}
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                    {activeRoom.wordLength || 0} Harf
                  </span>
                </div>
              )}
            </div>
          ) : activeRoom.status === 'round_end' ? (
            <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-indigo-300 bg-indigo-950/60 px-3 py-1 rounded-xl border border-indigo-500/30">
              <span>Doğru Kelime:</span>
              <span className="text-emerald-400 font-black tracking-wider uppercase">{activeRoom.revealedWord}</span>
            </div>
          ) : (
            <div className="text-xs font-black text-amber-400 bg-amber-950/60 px-3 py-1 rounded-xl border border-amber-500/30">
              🏆 Oyun Tamamlandı!
            </div>
          )}
        </div>

        {/* Right: Round Timer */}
        <div className="flex items-center gap-2">
          {activeRoom.status !== 'lobby' && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono font-black text-xs sm:text-sm border shadow-sm ${
              activeRoom.timer <= 10 
                ? 'bg-rose-600/20 text-rose-400 border-rose-500/40 animate-pulse' 
                : 'bg-slate-800 text-slate-200 border-slate-700'
            }`}>
              <Clock size={16} />
              <span>{activeRoom.timer}s</span>
            </div>
          )}
        </div>

      </div>

      {/* 2. MAIN BODY (PLAYERS - CANVAS - CHAT) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        
        {/* LEFT COLUMN: PLAYERS SCOREBOARD */}
        <div className="w-full lg:w-56 bg-slate-950/50 border-r border-slate-800 flex flex-col justify-between shrink-0 p-3 overflow-y-auto max-h-40 lg:max-h-full">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-400 uppercase tracking-wider px-1">
              <span>Oyuncular ({activeRoom.players.length})</span>
              <span>Puan</span>
            </div>

            <div className="space-y-1.5">
              {activeRoom.players.map((p, idx) => {
                const isCurrentDrawer = p.id === activeRoom.drawerId;
                const isMe = p.id === currentUserId;

                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-2 rounded-xl border transition-all text-xs ${
                      p.hasGuessed
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                        : isCurrentDrawer
                        ? 'bg-purple-950/40 border-purple-500/50 text-purple-200 ring-1 ring-purple-500/30'
                        : isMe
                        ? 'bg-slate-800/80 border-slate-700 text-slate-100'
                        : 'bg-slate-900/60 border-slate-800/60 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="relative shrink-0">
                        <Avatar url={p.avatar} color={p.color} name={p.username} size={8} />
                        {p.isHost && (
                          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-[9px] font-black shadow">
                            👑
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="font-bold truncate flex items-center gap-1">
                          <span className="truncate">{p.username}</span>
                          {isMe && <span className="text-[10px] text-slate-400 font-normal">(Sen)</span>}
                        </div>
                        <div className="text-[10px] flex items-center gap-1">
                          {isCurrentDrawer ? (
                            <span className="text-purple-400 font-bold flex items-center gap-0.5">
                              <Pencil size={10} /> Çiziyor
                            </span>
                          ) : p.hasGuessed ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                              <CheckCircle2 size={10} /> Bildi
                            </span>
                          ) : (
                            <span className="text-slate-500">Tahmin Ediyor</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 pl-1">
                      <span className="font-mono font-black text-xs text-amber-400">
                        {p.score}
                      </span>
                      {isHost && !p.isHost && (
                        <button
                          onClick={() => handleKickPlayer(p.id)}
                          className="p-1 rounded-md hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Odadan At"
                        >
                          <UserMinus size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lobby Host Control */}
          {activeRoom.status === 'lobby' && (
            <div className="pt-3 border-t border-slate-800 space-y-2">
              {isHost ? (
                <button
                  onClick={handleStartGame}
                  disabled={activeRoom.players.length < 2}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md ${
                    activeRoom.players.length >= 2
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-900/30'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  }`}
                >
                  <Play size={14} /> Oyunu Başlat
                </button>
              ) : (
                <div className="text-center p-2 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400 animate-pulse">
                  Kurucunun oyunu başlatması bekleniyor...
                </div>
              )}
            </div>
          )}
        </div>

        {/* CENTER COLUMN: CANVAS & TOOLBAR */}
        <div className="flex-1 flex flex-col bg-slate-950 p-2 sm:p-4 overflow-hidden items-center justify-center relative">
          
          {/* Canvas Viewport Frame */}
          <div className="w-full max-w-4xl h-full flex flex-col justify-center items-center relative">
            
            {/* HTML5 Canvas Container */}
            <div className="relative w-full aspect-[16/10] max-h-[560px] bg-white rounded-2xl overflow-hidden shadow-2xl border-2 border-slate-700/80 cursor-crosshair touch-none">
              <canvas
                ref={canvasRef}
                onMouseDown={handleStartDraw}
                onMouseMove={handleMoveDraw}
                onMouseUp={handleEndDraw}
                onMouseLeave={handleEndDraw}
                onTouchStart={handleStartDraw}
                onTouchMove={handleMoveDraw}
                onTouchEnd={handleEndDraw}
                className="w-full h-full block bg-white"
                style={{ touchAction: 'none' }}
              />

              {/* Waiting / choosing notice on canvas */}
              {activeRoom.status === 'lobby' && (
                <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-[2px] flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center text-3xl">
                    🎨
                  </div>
                  <h3 className="text-xl font-black text-white">Çizim Odasına Hoş Geldiniz!</h3>
                  <p className="text-xs text-slate-300 max-w-md">
                    Oyun başladığında sırası gelen oyuncu kelimeyi çizecek, diğerleri sağdaki sohbet kutusundan doğru kelimeyi bulmaya çalışacak.
                  </p>
                  {isHost && activeRoom.players.length >= 2 && (
                    <button
                      onClick={handleStartGame}
                      className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg cursor-pointer transition-all"
                    >
                      Hemen Başlat (2+ Oyuncu Hazır)
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* DRAWING TOOLBAR (Visible ONLY for active drawer) */}
            {isDrawer ? (
              <div className="w-full mt-3 p-2.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-lg">
                
                {/* Color Palette */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {COLOR_PALETTE.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setSelectedColor(c);
                        setIsEraser(false);
                      }}
                      className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                        selectedColor === c && !isEraser
                          ? 'scale-125 border-white ring-2 ring-purple-500 shadow-md'
                          : 'border-slate-700 hover:scale-110'
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>

                {/* Brush Sizes & Eraser & Clear */}
                <div className="flex items-center gap-2">
                  {/* Brush Sizes */}
                  <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
                    {BRUSH_SIZES.map(b => (
                      <button
                        key={b.size}
                        type="button"
                        onClick={() => setBrushSize(b.size)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          brushSize === b.size
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>

                  {/* Eraser Tool */}
                  <button
                    type="button"
                    onClick={() => setIsEraser(!isEraser)}
                    className={`p-2 rounded-xl border transition-all cursor-pointer ${
                      isEraser
                        ? 'bg-amber-600 text-white border-amber-500 shadow-md'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                    }`}
                    title="Silgi"
                  >
                    <Eraser size={16} />
                  </button>

                  {/* Clear Canvas */}
                  <button
                    type="button"
                    onClick={handleClearCanvasClick}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600/80 text-slate-400 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                    title="Ekranı Temizle"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

              </div>
            ) : (
              activeRoom.status === 'drawing' && (
                <div className="w-full mt-2 py-1 px-4 text-center text-xs font-semibold text-slate-400 flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping" />
                  <span><strong>{activeRoom.drawerUsername}</strong> çiziyor... Tahmininizi sağdaki sohbete yazın!</span>
                </div>
              )
            )}

          </div>

        </div>

        {/* RIGHT COLUMN: IN-GAME CHAT & GUESSING PANEL */}
        <div className="w-full lg:w-72 bg-slate-950/80 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col justify-between shrink-0 h-48 lg:h-full">
          
          {/* Chat Header */}
          <div className="px-3 py-2 border-b border-slate-800 text-xs font-extrabold text-slate-300 flex items-center justify-between">
            <span>Tahmin & Sohbet</span>
            <span className="text-[10px] text-slate-500 font-medium">Gizli Tahmin Modu</span>
          </div>

          {/* Messages Feed */}
          <div
            ref={chatScrollRef}
            className="flex-1 p-3 overflow-y-auto space-y-2 text-xs"
          >
            {chatMessages.length === 0 ? (
              <div className="text-center text-slate-500 py-6 text-[11px]">
                Sohbet henüz boş. Tahminlerini buraya yaz!
              </div>
            ) : (
              chatMessages.map(msg => {
                if (msg.isCorrect) {
                  return (
                    <div
                      key={msg.id}
                      className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center gap-1.5 animate-in fade-in"
                    >
                      <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                      <span>{msg.text}</span>
                    </div>
                  );
                }

                if (msg.isSystem) {
                  return (
                    <div
                      key={msg.id}
                      className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 text-[11px] text-center"
                    >
                      {msg.text}
                    </div>
                  );
                }

                const isMe = msg.userId === currentUserId;
                return (
                  <div key={msg.id} className="leading-snug">
                    <span className={`font-bold ${isMe ? 'text-indigo-400' : 'text-slate-300'}`}>
                      {msg.username}:
                    </span>{' '}
                    <span className="text-slate-200 break-words">{msg.text}</span>
                  </div>
                );
              })
            )}
          </div>

          {/* Chat / Guess Input Box */}
          <form onSubmit={handleSendChat} className="p-2 border-t border-slate-800 flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              disabled={isDrawer}
              placeholder={isDrawer ? 'Çizerken tahmin yapamazsınız' : 'Tahminini buraya yaz...'}
              className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={isDrawer || !chatInput.trim()}
              className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors cursor-pointer"
            >
              <Send size={14} />
            </button>
          </form>

        </div>

      </div>

      {/* 3. WORD SELECTION MODAL (Drawer Only) */}
      {isChoosing && activeRoom.wordChoices && activeRoom.wordChoices.length > 0 && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 rounded-3xl border border-purple-500/40 shadow-2xl p-6 text-center space-y-5 animate-in fade-in zoom-in">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center mx-auto text-2xl">
              <Pencil size={28} />
            </div>

            <div>
              <h3 className="text-xl font-black text-white">Çizmek İstediğin Kelimeyi Seç!</h3>
              <p className="text-xs text-slate-400 mt-1">
                Kalan Süre: <strong className="text-amber-400">{activeRoom.timer} saniye</strong>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {activeRoom.wordChoices.map((c, i) => {
                const badgeColor = 
                  c.difficulty === 'easy' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                  c.difficulty === 'medium' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                  'bg-rose-500/20 text-rose-300 border-rose-500/40';

                const diffLabel = 
                  c.difficulty === 'easy' ? 'Kolay' :
                  c.difficulty === 'medium' ? 'Orta' : 'Zor';

                return (
                  <button
                    key={i}
                    onClick={() => handleSelectWord(c.word)}
                    className="p-4 rounded-2xl bg-slate-800 hover:bg-purple-900/40 border border-slate-700 hover:border-purple-500 transition-all text-center space-y-2 cursor-pointer group transform hover:-translate-y-1"
                  >
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${badgeColor}`}>
                      {diffLabel} • {c.points} Puan
                    </span>
                    <div className="text-base font-extrabold text-white group-hover:text-purple-300">
                      {c.word}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 4. ROUND END OVERLAY */}
      {activeRoom.status === 'round_end' && (
        <div className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-[2px] flex items-center justify-center p-4 pointer-events-none">
          <div className="max-w-md w-full bg-slate-900/95 rounded-3xl border border-indigo-500/40 shadow-2xl p-6 text-center space-y-4 animate-in zoom-in-95">
            <div className="text-3xl">🔔</div>
            <h3 className="text-lg font-black text-slate-200">Tur Tamamlandı!</h3>
            <div className="p-4 rounded-2xl bg-indigo-950/50 border border-indigo-500/30">
              <span className="text-xs text-indigo-300 uppercase tracking-widest block font-bold mb-1">
                DOĞRU KELİME
              </span>
              <span className="text-2xl font-black text-emerald-400 tracking-wider uppercase">
                {activeRoom.revealedWord}
              </span>
            </div>
            <p className="text-xs text-slate-400 animate-pulse">
              Yeni tur birkaç saniye içinde başlıyor...
            </p>
          </div>
        </div>
      )}

      {/* 5. GAME OVER PODIUM OVERLAY */}
      {activeRoom.status === 'game_over' && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-slate-900 rounded-3xl border border-amber-500/40 shadow-2xl p-6 sm:p-8 text-center space-y-6 animate-in zoom-in">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
              <Trophy size={36} />
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Oyun Bitti!
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Tüm turlar tamamlandı. İşte nihai skor tablosu:
              </p>
            </div>

            {/* Podium Players */}
            <div className="space-y-2">
              {[...activeRoom.players]
                .sort((a, b) => b.score - a.score)
                .map((p, rank) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-3 rounded-2xl border ${
                      rank === 0
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                        : rank === 1
                        ? 'bg-slate-700/40 border-slate-600 text-slate-200'
                        : rank === 2
                        ? 'bg-amber-900/20 border-amber-800/40 text-amber-300'
                        : 'bg-slate-800/40 border-slate-700/50 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-black text-sm w-6 text-center">
                        {rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `${rank + 1}.`}
                      </span>
                      <Avatar url={p.avatar} color={p.color} name={p.username} size={8} />
                      <span className="font-bold text-sm text-white">{p.username}</span>
                    </div>
                    <span className="font-mono font-black text-base text-amber-400">
                      {p.score} Puan
                    </span>
                  </div>
                ))}
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-800 flex gap-3">
              <button
                onClick={handleLeaveRoom}
                className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition-colors"
              >
                Lobiye Dön
              </button>
              {isHost && (
                <button
                  onClick={handleRestartGame}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg cursor-pointer transition-all"
                >
                  Yeni Oyun Başlat
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
