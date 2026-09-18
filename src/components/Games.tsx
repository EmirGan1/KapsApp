import React, { useState } from 'react';
import { Gamepad2, Users, RefreshCcw } from 'lucide-react';

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

// Helper to generate a random tile
const getRandomTile = (): Tile => {
  const colors: TileColor[] = ['red', 'blue', 'black', 'yellow'];
  const isFake = Math.random() < 0.02; // 2% chance for sahte okey
  if (isFake) {
    return { id: Math.random().toString(), number: 0, color: 'fake' };
  }
  return {
    id: Math.random().toString(),
    number: Math.floor(Math.random() * 13) + 1,
    color: colors[Math.floor(Math.random() * colors.length)]
  };
};

const INITIAL_RACK_SIZE = 30; // 2 rows of 15 slots

export default function Games() {
  const [rack, setRack] = useState<RackSlot[]>(() => {
    const initialRack: RackSlot[] = Array.from({ length: INITIAL_RACK_SIZE }, (_, i) => ({
      index: i,
      tile: null,
    }));
    // Distribute 14 random tiles to start
    for (let i = 0; i < 14; i++) {
      initialRack[i].tile = getRandomTile();
    }
    return initialRack;
  });

  const [discardPile, setDiscardPile] = useState<Tile[]>([]);
  const [draggedTileIndex, setDraggedTileIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedTileIndex(index);
    // Needed for Firefox
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

      // Swap the tiles
      newRack[draggedTileIndex].tile = targetTile;
      newRack[targetIndex].tile = draggedTile;

      return newRack;
    });
    setDraggedTileIndex(null);
  };

  const handleDropOnDiscard = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedTileIndex === null) return;

    const tileToDiscard = rack[draggedTileIndex].tile;
    if (!tileToDiscard) return;

    setDiscardPile((prev) => [...prev, tileToDiscard]);
    
    setRack((prevRack) => {
      const newRack = [...prevRack];
      newRack[draggedTileIndex].tile = null;
      return newRack;
    });
    
    setDraggedTileIndex(null);
  };

  const drawTile = () => {
    // Find first empty slot
    const firstEmptyIndex = rack.findIndex(slot => slot.tile === null);
    if (firstEmptyIndex === -1) {
      alert("Istakan dolu!");
      return;
    }

    const newTile = getRandomTile();
    setRack(prev => {
      const newRack = [...prev];
      newRack[firstEmptyIndex].tile = newTile;
      return newRack;
    });
  };

  const resetGame = () => {
    const initialRack: RackSlot[] = Array.from({ length: INITIAL_RACK_SIZE }, (_, i) => ({
      index: i,
      tile: null,
    }));
    for (let i = 0; i < 14; i++) {
      initialRack[i].tile = getRandomTile();
    }
    setRack(initialRack);
    setDiscardPile([]);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-900 text-slate-100 overflow-hidden relative selection:bg-transparent">
      {/* Game Header */}
      <div className="p-4 bg-slate-950 flex items-center justify-between border-b border-slate-800 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/50">
            <Gamepad2 className="text-white" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-emerald-400">Okey 101 Masası</h2>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <Users size={12} /> 4 Oyuncu
            </p>
          </div>
        </div>
        
        <button 
          onClick={resetGame}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors text-sm font-medium"
        >
          <RefreshCcw size={16} />
          <span className="hidden sm:inline">Yeniden Dağıt</span>
        </button>
      </div>

      {/* Game Table Area */}
      <div className="flex-1 relative flex flex-col justify-between p-4 overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-900 to-slate-900">
        
        {/* Opponents Area (Top, Left, Right) - Mock UI */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center opacity-80">
          <div className="w-12 h-12 bg-slate-800 rounded-full mb-2 flex items-center justify-center text-slate-400 border-2 border-slate-700">O3</div>
          <div className="w-48 h-8 bg-amber-800/80 rounded-sm border-t-4 border-amber-700 shadow-xl flex gap-0.5 p-0.5 justify-center">
            {Array.from({length: 14}).map((_, i) => <div key={i} className="w-2.5 h-full bg-slate-200 rounded-[1px]"></div>)}
          </div>
        </div>

        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col items-center opacity-80">
           <div className="w-12 h-12 bg-slate-800 rounded-full mb-2 flex items-center justify-center text-slate-400 border-2 border-slate-700">O2</div>
           <div className="w-8 h-40 bg-amber-800/80 rounded-sm border-l-4 border-amber-700 shadow-xl flex flex-col gap-0.5 p-0.5 justify-center">
             {Array.from({length: 14}).map((_, i) => <div key={i} className="h-2.5 w-full bg-slate-200 rounded-[1px]"></div>)}
           </div>
        </div>

        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center opacity-80">
           <div className="w-12 h-12 bg-slate-800 rounded-full mb-2 flex items-center justify-center text-slate-400 border-2 border-slate-700">O4</div>
           <div className="w-8 h-40 bg-amber-800/80 rounded-sm border-r-4 border-amber-700 shadow-xl flex flex-col gap-0.5 p-0.5 justify-center">
             {Array.from({length: 14}).map((_, i) => <div key={i} className="h-2.5 w-full bg-slate-200 rounded-[1px]"></div>)}
           </div>
        </div>

        {/* Center Deck & Discards */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-8">
           {/* Center Deck */}
           <div 
             onClick={drawTile}
             className="relative w-14 h-20 bg-slate-200 rounded-md shadow-2xl cursor-pointer hover:-translate-y-1 transition-transform border border-slate-300 flex items-center justify-center"
             title="Taş Çek"
           >
             <div className="absolute inset-1 border-2 border-dashed border-slate-400 rounded-sm opacity-50"></div>
             <div className="w-14 h-20 bg-slate-200 rounded-md absolute -bottom-1 -right-1 -z-10 border border-slate-300"></div>
             <div className="w-14 h-20 bg-slate-200 rounded-md absolute -bottom-2 -right-2 -z-20 border border-slate-300"></div>
             <span className="text-slate-400 font-black text-xl rotate-45 opacity-50">Okey</span>
           </div>

           {/* Indicator Tile (Gösterge) */}
           <div className="relative w-14 h-20 bg-white rounded-md shadow-xl border border-slate-200 flex flex-col items-center justify-center opacity-90">
             <span className="text-lg font-bold text-red-600">4</span>
             <div className="w-4 h-4 rounded-full bg-red-600"></div>
             <div className="absolute -top-3 px-2 py-0.5 bg-slate-800 text-xs text-white rounded-full">Gösterge</div>
           </div>
        </div>

        {/* Bottom Area: Player Rack & Discard */}
        <div className="mt-auto flex items-end justify-center gap-4 pb-4 w-full">
           
           {/* Player Rack */}
           <div className="bg-[#603813] p-3 rounded-lg border-b-8 border-[#3b2109] shadow-2xl overflow-x-auto custom-scrollbar relative">
             <div className="absolute top-0 left-0 w-full h-2 bg-[#7a4819]"></div>
             
             <div className="grid grid-rows-2 gap-2 relative z-10 pt-2 min-w-[max-content]">
               {/* Top Row */}
               <div className="flex gap-1.5 h-[90px]">
                 {rack.slice(0, 15).map((slot) => (
                   <RackSlotComponent 
                     key={slot.index} 
                     slot={slot} 
                     onDragStart={handleDragStart}
                     onDragOver={handleDragOver}
                     onDrop={handleDropOnRack}
                   />
                 ))}
               </div>
               
               {/* Bottom Row */}
               <div className="flex gap-1.5 h-[90px]">
                 {rack.slice(15, 30).map((slot) => (
                   <RackSlotComponent 
                     key={slot.index} 
                     slot={slot} 
                     onDragStart={handleDragStart}
                     onDragOver={handleDragOver}
                     onDrop={handleDropOnRack}
                   />
                 ))}
               </div>
             </div>
           </div>

           {/* Discard Pile (Yere Atılan) */}
           <div 
             className="w-20 h-28 bg-slate-800/80 rounded-xl border-2 border-dashed border-slate-600 flex items-center justify-center relative shrink-0"
             onDragOver={handleDragOver}
             onDrop={handleDropOnDiscard}
           >
             {discardPile.length === 0 ? (
               <span className="text-slate-500 text-sm text-center font-medium">Buraya<br/>At</span>
             ) : (
               <div className="absolute scale-90">
                 <TileComponent tile={discardPile[discardPile.length - 1]} />
                 <span className="absolute -top-3 -right-3 bg-red-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-lg z-10">
                   {discardPile.length}
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

function RackSlotComponent({ 
  slot, 
  onDragStart, 
  onDragOver, 
  onDrop 
}: { 
  slot: RackSlot, 
  onDragStart: (e: React.DragEvent, index: number) => void,
  onDragOver: (e: React.DragEvent) => void,
  onDrop: (e: React.DragEvent, index: number) => void
}) {
  return (
    <div 
      className="w-[50px] h-full bg-[#4a2a0a]/50 rounded-sm border border-[#3b2109]/30 flex items-center justify-center relative shadow-inner"
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, slot.index)}
    >
      {slot.tile && (
        <TileComponent 
          tile={slot.tile} 
          draggable 
          onDragStart={(e) => onDragStart(e, slot.index)}
        />
      )}
    </div>
  );
}

function TileComponent({ 
  tile, 
  draggable, 
  onDragStart 
}: { 
  tile: Tile, 
  draggable?: boolean, 
  onDragStart?: (e: React.DragEvent) => void 
}) {
  const colorMap = {
    'red': 'text-red-600',
    'blue': 'text-blue-600',
    'black': 'text-slate-900',
    'yellow': 'text-amber-500' // Using amber for better visibility instead of pure yellow
  };

  if (tile.color === 'fake') {
    return (
      <div 
        draggable={draggable}
        onDragStart={onDragStart}
        className="w-[46px] h-[70px] bg-[#FDFBF7] rounded-md shadow-[0_4px_0_0_#d1d5db,0_5px_5px_rgba(0,0,0,0.4)] border border-slate-300 flex items-center justify-center cursor-grab active:cursor-grabbing hover:-translate-y-1 transition-transform relative"
      >
        <div className="w-8 h-8 rounded-full border-4 border-slate-800 flex items-center justify-center">
           <div className="w-3 h-3 rounded-full bg-slate-800"></div>
        </div>
        <div className="absolute inset-1 rounded-sm border border-slate-100"></div>
      </div>
    );
  }

  return (
    <div 
      draggable={draggable}
      onDragStart={onDragStart}
      className={`w-[46px] h-[70px] bg-[#FDFBF7] rounded-md shadow-[0_4px_0_0_#d1d5db,0_5px_5px_rgba(0,0,0,0.4)] border border-slate-300 flex flex-col items-center justify-center gap-1 cursor-grab active:cursor-grabbing hover:-translate-y-1 transition-transform relative ${colorMap[tile.color]}`}
    >
      <span className="text-3xl font-black leading-none mt-1">{tile.number}</span>
      <div className={`w-3 h-3 rounded-full ${
        tile.color === 'red' ? 'bg-red-600' : 
        tile.color === 'blue' ? 'bg-blue-600' : 
        tile.color === 'black' ? 'bg-slate-900' : 'bg-amber-500'
      }`}></div>
      <div className="absolute inset-1 rounded-sm border border-slate-100"></div>
    </div>
  );
}
