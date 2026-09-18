import React, { useState, useEffect } from 'react';
import { Gamepad2, Users, RefreshCcw, LogOut, Plus, Play } from 'lucide-react';
import { Socket } from 'socket.io-client';
import Avatar from './Avatar';

type TileColor = 'red' | 'blue' | 'black' | 'yellow' | 'fake';
interface Tile {
  id: string;
  number: number;
  color: TileColor;
}

interface RackSlot {
  index: number;
  tile: Tile | null;
}

const INITIAL_RACK_SIZE = 30; // 2 rows of 15 slots

export default function Games({ 
  socket, currentUserId, username, avatar, color 
}: { 
  socket: Socket | null; currentUserId: number; username: string; avatar?: string; color?: string; 
}) {
  const [rooms, setRooms] = useState<any[]>([]);
  const [currentRoom, setCurrentRoom] = useState<any | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomMode, setNewRoomMode] = useState<'classic'|'101'>('101');

  const [rack, setRack] = useState<RackSlot[]>(Array.from({ length: INITIAL_RACK_SIZE }, (_, i) => ({ index: i, tile: null })));
  const [draggedTileIndex, setDraggedTileIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!socket) return;
    
    socket.emit("get_okey_rooms");

    socket.on("okey_rooms_list", (roomList) => {
      setRooms(roomList);
    });

    socket.on("okey_state", (state: any) => {
      setCurrentRoom(state);
    });

    return () => {
      socket.off("okey_rooms_list");
      socket.off("okey_state");
    };
  }, [socket]);

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim() || !socket) return;
    socket.emit("create_okey_room", { name: newRoomName, gameMode: newRoomMode });
    setIsCreating(false);
    setNewRoomName('');
  };

  const joinRoom = (roomId: string) => {
    if (!socket) return;
    socket.emit("join_okey", roomId);
  };

  const leaveRoom = () => {
    if (!socket) return;
    socket.emit("leave_okey");
    setCurrentRoom(null);
  };

  const startGame = () => {
    if (!socket || !currentRoom) return;
    socket.emit("start_okey_game", currentRoom.id);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedTileIndex(index);
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnRack = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedTileIndex === null || draggedTileIndex === targetIndex) return;
    setRack((prevRack) => {
      const newRack = [...prevRack];
      const draggedTile = newRack[draggedTileIndex].tile;
      const targetTile = newRack[targetIndex].tile;
      newRack[draggedTileIndex].tile = targetTile;
      newRack[targetIndex].tile = draggedTile;
      return newRack;
    });
    setDraggedTileIndex(null);
  };

  const handleDropOnDiscard = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedTileIndex === null || !currentRoom) return;
    const tileToDiscard = rack[draggedTileIndex].tile;
    if (!tileToDiscard) return;
    
    if (socket) {
      socket.emit("okey_discard", tileToDiscard);
    }
    setRack((prevRack) => {
      const newRack = [...prevRack];
      newRack[draggedTileIndex].tile = null;
      return newRack;
    });
    setDraggedTileIndex(null);
  };

  // Mocking draw for UI since fully server-authoritative requires a lot of back-and-forth
  const drawTile = () => {
    const firstEmptyIndex = rack.findIndex(slot => slot.tile === null);
    if (firstEmptyIndex === -1) {
      alert("Istakan dolu!");
      return;
    }
    const colors: TileColor[] = ['red', 'blue', 'black', 'yellow'];
    const newTile = {
      id: Math.random().toString(),
      number: Math.floor(Math.random() * 13) + 1,
      color: colors[Math.floor(Math.random() * colors.length)]
    };
    setRack(prev => {
      const newRack = [...prev];
      newRack[firstEmptyIndex].tile = newTile;
      return newRack;
    });
  };

  if (!currentRoom) {
    return (
      <div className="flex-1 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 overflow-y-auto p-6 transition-colors duration-200">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
                <Gamepad2 className="text-emerald-500" size={28} />
                Oyun Lobisi
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">Açık odalara katıl veya kendi masanı kur.</p>
            </div>
            <button 
              onClick={() => setIsCreating(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-colors shadow-sm flex items-center gap-2"
            >
              <Plus size={18} /> Masa Kur
            </button>
          </div>

          {isCreating && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
              <h2 className="font-semibold text-lg mb-4">Yeni Masa Oluştur</h2>
              <form onSubmit={handleCreateRoom} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Oda Adı</label>
                  <input 
                    type="text" 
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-emerald-500"
                    placeholder="Eğlencelik Masa"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Oyun Modu</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" checked={newRoomMode === '101'} onChange={() => setNewRoomMode('101')} className="accent-emerald-500" />
                      <span>101 Okey</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" checked={newRoomMode === 'classic'} onChange={() => setNewRoomMode('classic')} className="accent-emerald-500" />
                      <span>Klasik Okey</span>
                    </label>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-colors">İptal</button>
                  <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors">Oluştur</button>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rooms.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-500 dark:text-slate-400">
                Şu an aktif masa bulunmuyor. Yeni bir tane kurabilirsin!
              </div>
            ) : (
              rooms.map((room) => (
                <div key={room.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex justify-between items-center transition-colors">
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100">{room.name}</h3>
                    <div className="flex gap-3 text-xs mt-1 text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1"><Users size={12}/> {room.players} / 4</span>
                      <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{room.gameMode === '101' ? '101 Okey' : 'Klasik'}</span>
                      <span className={room.status === 'playing' ? 'text-amber-500' : 'text-emerald-500'}>
                        {room.status === 'playing' ? 'Oyun Başladı' : 'Bekleniyor'}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => joinRoom(room.id)}
                    disabled={room.players >= 4}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${room.players >= 4 ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                  >
                    Katıl
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- GAME VIEW ---
  const tablePlayers = currentRoom.players || [];
  let topOpponent = null;
  let leftOpponent = null;
  let rightOpponent = null;

  if (tablePlayers.length > 0) {
    const myIndex = tablePlayers.findIndex((p:any) => p.id === currentUserId);
    if (myIndex !== -1) {
      rightOpponent = tablePlayers[(myIndex + 1) % 4] || null;
      topOpponent = tablePlayers[(myIndex + 2) % 4] || null;
      leftOpponent = tablePlayers[(myIndex + 3) % 4] || null;
    } else {
      leftOpponent = tablePlayers[0] || null;
      topOpponent = tablePlayers[1] || null;
      rightOpponent = tablePlayers[2] || null;
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-900 text-slate-100 overflow-hidden relative selection:bg-transparent transition-colors">
      {/* Game Header */}
      <div className="p-3 md:p-4 bg-slate-950 flex items-center justify-between border-b border-slate-800 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/50">
            <Gamepad2 className="text-white w-4 h-4 md:w-5 md:h-5" />
          </div>
          <div>
            <h2 className="font-bold text-sm md:text-lg text-emerald-400">{currentRoom.name} <span className="text-xs text-slate-500 font-normal">({currentRoom.gameMode === '101' ? '101 Okey' : 'Klasik'})</span></h2>
            <p className="text-[10px] md:text-xs text-slate-400 flex items-center gap-1">
              <Users size={12} /> {tablePlayers.length} / 4 Oyuncu
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          {currentRoom.status === 'waiting' && tablePlayers.length > 1 && (
            <button onClick={startGame} className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-xs md:text-sm font-medium">
              <Play size={16} /> <span className="hidden sm:inline">Oyunu Başlat</span>
            </button>
          )}
          <button onClick={leaveRoom} className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-slate-800 hover:bg-slate-700 text-red-400 rounded-lg transition-colors text-xs md:text-sm font-medium">
            <LogOut size={16} /> <span className="hidden sm:inline">Ayrıl</span>
          </button>
        </div>
      </div>

      {/* Game Table Area */}
      <div className="flex-1 relative flex flex-col justify-between p-2 md:p-4 overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-900 to-slate-900">
        
        {/* Opponents Area (Top, Left, Right) */}
        <div className="absolute top-2 md:top-4 left-1/2 -translate-x-1/2 flex flex-col items-center opacity-90">
          {topOpponent ? (
             <div className="mb-2 flex flex-col items-center">
               <Avatar url={topOpponent.avatar} name={topOpponent.username} color={topOpponent.color} size={10} />
               <span className="text-[10px] mt-1 bg-slate-800/80 px-2 py-0.5 rounded-full shadow-md">{topOpponent.username.split(" ")[0]}</span>
             </div>
          ) : (
            <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-800 rounded-full mb-2 flex items-center justify-center text-slate-400 border-2 border-slate-700 text-xs">O3</div>
          )}
          <div className="w-32 md:w-48 h-6 md:h-8 bg-amber-800/80 rounded-sm border-t-4 border-amber-700 shadow-xl flex gap-0.5 p-0.5 justify-center">
            {Array.from({length: 14}).map((_, i) => <div key={i} className="w-1.5 md:w-2.5 h-full bg-slate-200 rounded-[1px]"></div>)}
          </div>
        </div>

        <div className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 flex flex-col items-center opacity-90 scale-75 md:scale-100 origin-left">
           {leftOpponent ? (
             <div className="mb-2 flex flex-col items-center">
               <Avatar url={leftOpponent.avatar} name={leftOpponent.username} color={leftOpponent.color} size={12} />
               <span className="text-[10px] mt-1 bg-slate-800/80 px-2 py-0.5 rounded-full shadow-md">{leftOpponent.username.split(" ")[0]}</span>
             </div>
           ) : (
             <div className="w-12 h-12 bg-slate-800 rounded-full mb-2 flex items-center justify-center text-slate-400 border-2 border-slate-700">O2</div>
           )}
           <div className="w-8 h-40 bg-amber-800/80 rounded-sm border-l-4 border-amber-700 shadow-xl flex flex-col gap-0.5 p-0.5 justify-center">
             {Array.from({length: 14}).map((_, i) => <div key={i} className="h-2.5 w-full bg-slate-200 rounded-[1px]"></div>)}
           </div>
        </div>

        <div className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 flex flex-col items-center opacity-90 scale-75 md:scale-100 origin-right">
           {rightOpponent ? (
             <div className="mb-2 flex flex-col items-center">
               <Avatar url={rightOpponent.avatar} name={rightOpponent.username} color={rightOpponent.color} size={12} />
               <span className="text-[10px] mt-1 bg-slate-800/80 px-2 py-0.5 rounded-full shadow-md">{rightOpponent.username.split(" ")[0]}</span>
             </div>
           ) : (
             <div className="w-12 h-12 bg-slate-800 rounded-full mb-2 flex items-center justify-center text-slate-400 border-2 border-slate-700">O4</div>
           )}
           <div className="w-8 h-40 bg-amber-800/80 rounded-sm border-r-4 border-amber-700 shadow-xl flex flex-col gap-0.5 p-0.5 justify-center">
             {Array.from({length: 14}).map((_, i) => <div key={i} className="h-2.5 w-full bg-slate-200 rounded-[1px]"></div>)}
           </div>
        </div>

        {/* Center Area */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-4 w-full px-12 md:px-32">
           {currentRoom.status === 'playing' ? (
             <div className="flex flex-col items-center gap-6 w-full">
               <div className="flex gap-4 md:gap-8">
                 {/* Center Deck */}
                 <div onClick={drawTile} className="relative w-10 h-14 md:w-14 md:h-20 bg-slate-200 rounded-md shadow-2xl cursor-pointer hover:-translate-y-1 transition-transform border border-slate-300 flex items-center justify-center" title="Taş Çek">
                   <div className="absolute inset-1 border-2 border-dashed border-slate-400 rounded-sm opacity-50"></div>
                   <div className="w-10 h-14 md:w-14 md:h-20 bg-slate-200 rounded-md absolute -bottom-1 -right-1 -z-10 border border-slate-300"></div>
                   <span className="text-slate-400 font-black text-sm md:text-xl rotate-45 opacity-50">Okey</span>
                 </div>
                 {/* Indicator Tile (Gösterge) */}
                 <div className="relative w-10 h-14 md:w-14 md:h-20 bg-white rounded-md shadow-xl border border-slate-200 flex flex-col items-center justify-center opacity-90">
                   {currentRoom.indicator ? (
                     <>
                        <span className={`text-sm md:text-lg font-bold ${currentRoom.indicator.color === 'red' ? 'text-red-600' : currentRoom.indicator.color === 'blue' ? 'text-blue-600' : currentRoom.indicator.color === 'black' ? 'text-slate-900' : 'text-amber-500'}`}>{currentRoom.indicator.number}</span>
                        <div className={`w-3 h-3 md:w-4 md:h-4 rounded-full ${currentRoom.indicator.color === 'red' ? 'bg-red-600' : currentRoom.indicator.color === 'blue' ? 'bg-blue-600' : currentRoom.indicator.color === 'black' ? 'bg-slate-900' : 'bg-amber-500'}`}></div>
                     </>
                   ) : (
                     <div className="text-slate-400 text-xs">Yok</div>
                   )}
                   <div className="absolute -top-3 md:-top-4 px-2 py-0.5 bg-slate-800 text-[9px] md:text-xs text-white rounded-full shadow-md whitespace-nowrap">Gösterge</div>
                 </div>
               </div>

               {/* 101 Melds Area */}
               {currentRoom.gameMode === '101' && (
                 <div className="w-full h-32 md:h-48 border-2 border-dashed border-emerald-700/50 rounded-2xl bg-emerald-950/30 flex flex-col items-center justify-center relative backdrop-blur-sm p-2 overflow-y-auto">
                   <div className="absolute top-2 text-emerald-700/80 text-xs md:text-sm font-semibold uppercase tracking-wider">Yere Açılan Perler</div>
                   <div className="text-slate-500 text-xs md:text-sm mt-4 text-center px-4">
                     Henüz per açılmadı.<br/>(Istakanızda serilerinizi hazırlayıp buraya açabilirsiniz.)
                   </div>
                 </div>
               )}
             </div>
           ) : (
             <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-2xl border border-slate-700 shadow-2xl text-center">
               <h3 className="text-xl font-bold text-white mb-2">Oyuncular Bekleniyor</h3>
               <p className="text-slate-400 text-sm mb-4">Masanın dolmasını veya kurucunun başlatmasını bekleyin.</p>
               <div className="flex justify-center gap-2">
                 {Array.from({length: 4}).map((_, i) => (
                   <div key={i} className={`w-3 h-3 rounded-full ${i < tablePlayers.length ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'bg-slate-700'}`}></div>
                 ))}
               </div>
             </div>
           )}
        </div>

        {/* Bottom Area: Player Rack & Discard */}
        <div className="mt-auto flex items-end justify-center gap-2 md:gap-4 pb-2 w-full origin-bottom">
           
           {/* Player Rack */}
           <div className="bg-[#603813] p-1.5 md:p-3 rounded-lg border-b-4 md:border-b-8 border-[#3b2109] shadow-2xl overflow-x-auto custom-scrollbar relative flex-1 max-w-[850px]">
             <div className="absolute top-0 left-0 w-full h-1.5 md:h-2 bg-[#7a4819]"></div>
             
             <div className="grid grid-rows-2 gap-1 md:gap-2 relative z-10 pt-1 md:pt-2 min-w-[max-content] md:min-w-0">
               {/* Top Row */}
               <div className="flex gap-0.5 md:gap-1.5 h-[50px] md:h-[90px]">
                 {rack.slice(0, 15).map((slot) => (
                   <RackSlotComponent key={slot.index} slot={slot} onDragStart={handleDragStart} onDragOver={handleDragOver} onDrop={handleDropOnRack} />
                 ))}
               </div>
               
               {/* Bottom Row */}
               <div className="flex gap-0.5 md:gap-1.5 h-[50px] md:h-[90px]">
                 {rack.slice(15, 30).map((slot) => (
                   <RackSlotComponent key={slot.index} slot={slot} onDragStart={handleDragStart} onDragOver={handleDragOver} onDrop={handleDropOnRack} />
                 ))}
               </div>
             </div>
             
             {/* 101 Hand Buttons */}
             {currentRoom.gameMode === '101' && currentRoom.status === 'playing' && (
               <div className="absolute -top-12 md:-top-14 right-0 flex gap-2">
                 <button className="px-3 md:px-5 py-1.5 md:py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm font-bold rounded-t-xl shadow-lg transition-colors">Ortaya Aç</button>
                 <button className="px-3 md:px-5 py-1.5 md:py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs md:text-sm font-bold rounded-t-xl shadow-lg transition-colors">Çifte Git</button>
               </div>
             )}
           </div>

           {/* Discard Pile (Yere Atılan) */}
           <div 
             className="w-12 h-16 md:w-20 md:h-28 bg-slate-800/80 rounded-xl border-2 border-dashed border-slate-600 flex items-center justify-center relative shrink-0 transition-transform"
             onDragOver={handleDragOver}
             onDrop={handleDropOnDiscard}
           >
             {currentRoom.discardPile.length === 0 ? (
               <span className="text-slate-500 text-[10px] md:text-sm text-center font-medium leading-tight">Buraya<br/>At</span>
             ) : (
               <div className="absolute scale-[0.6] md:scale-90 pointer-events-none">
                 <TileComponent tile={currentRoom.discardPile[currentRoom.discardPile.length - 1]} />
                 <span className="absolute -top-3 -right-3 bg-red-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-lg z-10 pointer-events-auto">
                   {currentRoom.discardPile.length}
                 </span>
               </div>
             )}
           </div>
        </div>
      </div>
    </div>
  );
}

// Subcomponents
function RackSlotComponent({ slot, onDragStart, onDragOver, onDrop }: { slot: RackSlot, onDragStart: (e: React.DragEvent, index: number) => void, onDragOver: (e: React.DragEvent) => void, onDrop: (e: React.DragEvent, index: number) => void }) {
  return (
    <div 
      className="w-[28px] md:w-[50px] h-full bg-[#4a2a0a]/50 rounded-sm border border-[#3b2109]/30 flex items-center justify-center relative shadow-inner"
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, slot.index)}
    >
      {slot.tile && <TileComponent tile={slot.tile} draggable onDragStart={(e) => onDragStart(e, slot.index)} />}
    </div>
  );
}

function TileComponent({ tile, draggable, onDragStart }: { tile: Tile, draggable?: boolean, onDragStart?: (e: React.DragEvent) => void }) {
  const colorMap = { 'red': 'text-red-600', 'blue': 'text-blue-600', 'black': 'text-slate-900', 'yellow': 'text-amber-500' };

  if (tile.color === 'fake') {
    return (
      <div 
        draggable={draggable}
        onDragStart={onDragStart}
        className="w-[26px] h-[46px] md:w-[46px] md:h-[70px] bg-[#FDFBF7] rounded shadow-[0_2px_0_0_#d1d5db,0_3px_3px_rgba(0,0,0,0.4)] md:shadow-[0_4px_0_0_#d1d5db,0_5px_5px_rgba(0,0,0,0.4)] border border-slate-300 flex items-center justify-center cursor-grab active:cursor-grabbing hover:-translate-y-1 transition-transform relative"
      >
        <div className="w-4 h-4 md:w-8 md:h-8 rounded-full border-2 md:border-4 border-slate-800 flex items-center justify-center">
           <div className="w-1.5 h-1.5 md:w-3 md:h-3 rounded-full bg-slate-800"></div>
        </div>
        <div className="absolute inset-0.5 md:inset-1 rounded-[1px] md:rounded-sm border border-slate-100"></div>
      </div>
    );
  }

  return (
    <div 
      draggable={draggable}
      onDragStart={onDragStart}
      className={`w-[26px] h-[46px] md:w-[46px] md:h-[70px] bg-[#FDFBF7] rounded shadow-[0_2px_0_0_#d1d5db,0_3px_3px_rgba(0,0,0,0.4)] md:shadow-[0_4px_0_0_#d1d5db,0_5px_5px_rgba(0,0,0,0.4)] border border-slate-300 flex flex-col items-center justify-center gap-0.5 md:gap-1 cursor-grab active:cursor-grabbing hover:-translate-y-1 transition-transform relative ${colorMap[tile.color]}`}
    >
      <span className="text-[16px] md:text-3xl font-black leading-none mt-0.5 md:mt-1">{tile.number}</span>
      <div className={`w-1.5 h-1.5 md:w-3 md:h-3 rounded-full ${tile.color === 'red' ? 'bg-red-600' : tile.color === 'blue' ? 'bg-blue-600' : tile.color === 'black' ? 'bg-slate-900' : 'bg-amber-500'}`}></div>
      <div className="absolute inset-0.5 md:inset-1 rounded-[1px] md:rounded-sm border border-slate-100"></div>
    </div>
  );
}

