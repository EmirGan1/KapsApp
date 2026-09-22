import React, { useState, useEffect } from 'react';
import { Gamepad2, Users, ChevronRight, Trophy, Sparkles, Bot, ShieldCheck, Crown, Medal, RefreshCw, Palette, Pencil } from 'lucide-react';
import { Socket } from 'socket.io-client';
import OkeyGame from './OkeyGame';
import Okey101Board from './Okey101Board';
import UnoGame from './UnoGame';
import DrawGuessGame from './DrawGuessGame';
import Avatar from './Avatar';
import { getApiUrl } from '../utils/api';

interface GamesProps {
  socket: Socket | null;
  currentUserId: number;
  username: string;
  avatar?: string | null;
  color?: string | null;
  onUserClick?: (id: number) => void;
}

interface LeaderboardUser {
  id: number;
  username: string;
  avatar: string | null;
  color?: string | null;
  okey_wins: number;
  okey101_wins?: number;
  uno_wins: number;
}

export default function Games({
  socket,
  currentUserId,
  username,
  avatar,
  color,
  onUserClick
}: GamesProps) {
  const [selectedGame, setSelectedGame] = useState<'hub' | 'okey' | 'okey101' | 'uno' | 'drawguess'>('hub');
  const [okeyRoomCount, setOkeyRoomCount] = useState<number>(0);
  const [okey101RoomCount, setOkey101RoomCount] = useState<number>(0);
  const [unoRoomCount, setUnoRoomCount] = useState<number>(0);
  const [drawguessRoomCount, setDrawguessRoomCount] = useState<number>(0);

  // Leaderboard state
  const [leaderboardTab, setLeaderboardTab] = useState<'okey' | 'uno'>('okey');
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardUser[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState<boolean>(false);

  // Fetch leaderboard data
  const fetchLeaderboard = (tab: 'okey' | 'uno') => {
    setLoadingLeaderboard(true);
    if (socket && socket.connected) {
      socket.emit("get_leaderboard", { type: tab }, (rows: LeaderboardUser[]) => {
        setLeaderboardData(rows || []);
        setLoadingLeaderboard(false);
      });
    } else {
      fetch(getApiUrl(`/api/leaderboard?type=${tab}`))
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setLeaderboardData(data);
          setLoadingLeaderboard(false);
        })
        .catch(() => setLoadingLeaderboard(false));
    }
  };

  useEffect(() => {
    fetchLeaderboard(leaderboardTab);
  }, [leaderboardTab, socket]);

  // Auto-detect if user is already in a game on connect
  useEffect(() => {
    if (!socket) return;

    // Check Okey presence
    const onOkeyRooms = (rooms: any[]) => {
      setOkeyRoomCount(rooms.length);
    };
    const onOkeyState = (state: any) => {
      if (state && state.id) {
        setSelectedGame('okey');
      }
    };

    // Check 101 Okey presence
    const onOkey101Rooms = (rooms: any[]) => {
      setOkey101RoomCount(rooms.length);
    };
    const onOkey101State = (state: any) => {
      if (state && state.id) {
        setSelectedGame('okey101');
      }
    };

    // Check UNO presence
    const onUnoRooms = (rooms: any[]) => {
      setUnoRoomCount(rooms.length);
    };
    const onUnoState = (state: any) => {
      if (state && state.id) {
        setSelectedGame('uno');
      }
    };

    // Check Draw & Guess presence
    const onDrawGuessRooms = (rooms: any[]) => {
      setDrawguessRoomCount(rooms.length);
    };

    socket.on("okey_rooms_list", onOkeyRooms);
    socket.on("okey_state", onOkeyState);
    socket.on("okey101_rooms_list", onOkey101Rooms);
    socket.on("okey101_state", onOkey101State);
    socket.on("uno_rooms_list", onUnoRooms);
    socket.on("uno_state", onUnoState);
    socket.on("drawguess_rooms_list", onDrawGuessRooms);

    socket.emit("get_okey_rooms");
    socket.emit("get_my_okey_room");
    socket.emit("get_okey101_rooms");
    socket.emit("get_my_okey101_room");
    socket.emit("get_uno_rooms");
    socket.emit("get_my_uno_room");
    socket.emit("get_drawguess_rooms");
    socket.emit("get_my_drawguess_room", (res: any) => {
      if (res?.success && res?.room) {
        setSelectedGame('drawguess');
      }
    });

    return () => {
      socket.off("okey_rooms_list", onOkeyRooms);
      socket.off("okey_state", onOkeyState);
      socket.off("okey101_rooms_list", onOkey101Rooms);
      socket.off("okey101_state", onOkey101State);
      socket.off("uno_rooms_list", onUnoRooms);
      socket.off("uno_state", onUnoState);
      socket.off("drawguess_rooms_list", onDrawGuessRooms);
    };
  }, [socket]);

  // Route to Okey
  if (selectedGame === 'okey') {
    return (
      <OkeyGame 
        socket={socket}
        currentUserId={currentUserId}
        username={username}
        avatar={avatar}
        color={color}
        onBackToHub={() => setSelectedGame('hub')}
      />
    );
  }

  // Route to 101 Okey
  if (selectedGame === 'okey101') {
    return (
      <Okey101Board 
        socket={socket}
        currentUserId={currentUserId}
        username={username}
        avatar={avatar}
        color={color}
        onBackToHub={() => setSelectedGame('hub')}
      />
    );
  }

  // Route to UNO
  if (selectedGame === 'uno') {
    return (
      <UnoGame 
        socket={socket}
        currentUserId={currentUserId}
        username={username}
        avatar={avatar}
        color={color}
        onBackToHub={() => setSelectedGame('hub')}
      />
    );
  }

  // Route to Draw & Guess
  if (selectedGame === 'drawguess') {
    return (
      <DrawGuessGame
        socket={socket}
        currentUserId={currentUserId}
        username={username}
        avatar={avatar}
        color={color}
        onBackToHub={() => setSelectedGame('hub')}
      />
    );
  }

  // --- GAME SELECTION HUB VIEW ---
  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 transition-colors">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Hub Header */}
        <div className="text-center sm:text-left border-b border-slate-200 dark:border-slate-800 pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold mb-3 border border-emerald-500/20">
            <Sparkles size={14} /> Çok Oyunculu Masa Oyunları
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center justify-center sm:justify-start gap-3">
            <Gamepad2 className="text-emerald-500" size={36} /> Oyun Salonu
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-2xl">
            İstediğin oyunu seç; ister gerçek kullanıcılarla canlı masalara otur, ister yapay zeka botlarına karşı pratik yap!
          </p>
        </div>

        {/* Game Selection Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          
          {/* Card 1: Klasik Okey */}
          <div 
            onClick={() => setSelectedGame('okey')}
            className="group relative cursor-pointer overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col justify-between transform hover:-translate-y-1"
          >
            {/* Top decorative gradient */}
            <div className="h-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
            
            <div className="p-6 sm:p-7 space-y-5">
              
              {/* Header inside card */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm group-hover:scale-110 transition-transform">
                    <span className="font-black text-2xl">🀄</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      Klasik Okey
                    </h2>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Geleneksel 4 Kişilik Masa
                    </span>
                  </div>
                </div>

                <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  {okeyRoomCount > 0 ? `${okeyRoomCount} Masa Aktif` : 'Canlı Lobi'}
                </span>
              </div>

              {/* Visual preview: Okey tile rack mockup */}
              <div className="bg-amber-900/10 dark:bg-amber-950/30 border border-amber-800/20 rounded-2xl p-3 flex items-center justify-center gap-1.5 shadow-inner">
                {[
                  { n: '1', c: 'text-red-500' },
                  { n: '2', c: 'text-red-500' },
                  { n: '3', c: 'text-red-500' },
                  { n: '7', c: 'text-blue-500' },
                  { n: '7', c: 'text-yellow-500' },
                  { n: '7', c: 'text-emerald-500' },
                  { n: '★', c: 'text-amber-500' }
                ].map((tile, i) => (
                  <div 
                    key={i}
                    className="w-7 h-10 rounded-md bg-amber-50 dark:bg-[#fff9e6] border border-amber-300 shadow flex flex-col items-center justify-center font-bold text-xs transform group-hover:-translate-y-0.5 transition-transform"
                  >
                    <span className={tile.c}>{tile.n}</span>
                  </div>
                ))}
              </div>

              {/* Feature bullets */}
              <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span><strong>Standart 106 Taş:</strong> 1-13 arası 4 renk ve Sahte Okeyler</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span><strong>Akıllı Istaka:</strong> Otomatik Seri (1-2-3) ve Çift Dizme butonları</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span><strong>Gerçek Zamanlı:</strong> Canlı taş çekme, atma ve gösterge puanlama</span>
                </li>
              </ul>
            </div>

            {/* Action footer */}
            <div className="p-5 bg-slate-50 dark:bg-slate-900/70 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Users size={14} /> 4 Kişi
              </span>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 group-hover:bg-emerald-500 text-white font-bold text-xs transition-colors shadow-md shadow-emerald-900/20">
                Okey Lobisine Gir <ChevronRight size={16} />
              </div>
            </div>
          </div>

          {/* Card 2: 101 Okey (Yüzbir) */}
          <div 
            onClick={() => setSelectedGame('okey101')}
            className="group relative cursor-pointer overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-500 shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col justify-between transform hover:-translate-y-1"
          >
            {/* Top decorative gradient */}
            <div className="h-2.5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />
            
            <div className="p-6 sm:p-7 space-y-5">
              
              {/* Header inside card */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-sm group-hover:scale-110 transition-transform">
                    <span className="font-black text-2xl">💯</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                      101 Okey
                    </h2>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Katlamalı & Katlamasız Masalar
                    </span>
                  </div>
                </div>

                <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  {okey101RoomCount > 0 ? `${okey101RoomCount} Masa Aktif` : 'Canlı Lobi'}
                </span>
              </div>

              {/* Visual preview: 101 Okey tile rack mockup */}
              <div className="bg-amber-950/20 border border-amber-800/30 rounded-2xl p-3 flex items-center justify-center gap-1.5 shadow-inner">
                {[
                  { n: '10', c: 'text-blue-500' },
                  { n: '11', c: 'text-blue-500' },
                  { n: '12', c: 'text-blue-500' },
                  { n: '|', c: 'text-slate-400 font-normal' },
                  { n: '8', c: 'text-red-500' },
                  { n: '8', c: 'text-yellow-500' },
                  { n: '8', c: 'text-emerald-500' },
                ].map((tile, i) => (
                  <div 
                    key={i}
                    className={`w-7 h-10 rounded-md ${tile.n === '|' ? 'bg-transparent border-0 w-2' : 'bg-amber-50 dark:bg-[#fff9e6] border border-amber-300 shadow flex flex-col items-center justify-center font-bold text-xs transform group-hover:-translate-y-0.5 transition-transform'}`}
                  >
                    <span className={tile.c}>{tile.n}</span>
                  </div>
                ))}
              </div>

              {/* Feature bullets */}
              <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span><strong>101 Puan / 5 Çift Barajı:</strong> Seri ve çift kombinasyonlarıyla masaya el açma</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span><strong>Per İşleme & Yan Taş:</strong> Masadaki perlere taş işleme ve yan taştan el açma</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span><strong>Katlamalı Mod & Ceza:</strong> 101 ceza puanı ve işler taş kontrolü</span>
                </li>
              </ul>
            </div>

            {/* Action footer */}
            <div className="p-5 bg-slate-50 dark:bg-slate-900/70 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Users size={14} /> 4 Kişi
              </span>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 group-hover:bg-amber-500 text-white font-bold text-xs transition-colors shadow-md shadow-amber-900/20">
                101 Lobisine Gir <ChevronRight size={16} />
              </div>
            </div>
          </div>

          {/* Card 3: UNO */}
          <div 
            onClick={() => setSelectedGame('uno')}
            className="group relative cursor-pointer overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-rose-500 dark:hover:border-rose-500 shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col justify-between transform hover:-translate-y-1"
          >
            {/* Top decorative gradient */}
            <div className="h-2.5 bg-gradient-to-r from-rose-600 via-amber-500 to-sky-500" />
            
            <div className="p-6 sm:p-7 space-y-5">
              
              {/* Header inside card */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-white font-black text-2xl shadow-sm group-hover:scale-110 transition-transform bg-gradient-to-br from-rose-600 to-amber-500">
                    U
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                        UNO
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white uppercase tracking-wider animate-pulse">
                        YENİ
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      2-4 Kişilik • Çok Oyunculu & Bot Destekli
                    </span>
                  </div>
                </div>

                <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                  {unoRoomCount > 0 ? `${unoRoomCount} Masa Aktif` : 'Canlı Lobi'}
                </span>
              </div>

              {/* Visual preview: UNO card deck mockup */}
              <div className="bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 flex items-center justify-center gap-2 shadow-inner">
                {[
                  { val: '7', bg: 'bg-rose-600', text: 'text-white' },
                  { val: '+2', bg: 'bg-sky-600', text: 'text-white' },
                  { val: '⇄', bg: 'bg-emerald-600', text: 'text-white' },
                  { val: '🚫', bg: 'bg-amber-400', text: 'text-slate-950' },
                  { val: '+4', bg: 'bg-gradient-to-br from-rose-600 via-amber-400 to-sky-600', text: 'text-white' }
                ].map((c, i) => (
                  <div 
                    key={i}
                    className={`w-7 h-10 sm:w-8 sm:h-11 rounded-lg ${c.bg} border border-white/80 shadow-md flex items-center justify-center font-black text-xs ${c.text} transform group-hover:scale-105 transition-transform`}
                    style={{ transform: `rotate(${(i - 2) * 6}deg)` }}
                  >
                    {c.val}
                  </div>
                ))}
              </div>

              {/* Feature bullets */}
              <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span><strong>108 Kartlık Standart Deste:</strong> 4 Renk, +2, Pas, Yön ve +4 Joker</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span><strong>Akıllı Bot Desteği:</strong> Boş koltuklara dilediğin an bot ekle/çıkar</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span><strong>Parlayan "UNO!" Butonu:</strong> Tek kart kaldığında bas, cezalardan kaç!</span>
                </li>
              </ul>
            </div>

            {/* Action footer */}
            <div className="p-5 bg-slate-50 dark:bg-slate-900/70 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Bot size={14} className="text-indigo-500" /> 2-4 Kişi & Bot
              </span>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 group-hover:bg-rose-500 text-white font-bold text-xs transition-colors shadow-md shadow-rose-900/20">
                UNO Lobisine Gir <ChevronRight size={16} />
              </div>
            </div>
          </div>

          {/* Card 3: Çiz & Tahmin Et (Draw & Guess) */}
          <div 
            onClick={() => setSelectedGame('drawguess')}
            className="group relative cursor-pointer overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-500 shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col justify-between transform hover:-translate-y-1"
          >
            {/* Top decorative gradient */}
            <div className="h-2.5 bg-gradient-to-r from-amber-500 via-violet-500 to-fuchsia-500" />
            
            <div className="p-6 sm:p-7 space-y-5">
              
              {/* Header inside card */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-sm group-hover:scale-110 transition-transform">
                    <Palette size={26} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                      Çiz & Tahmin Et
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Gartic & Skribbl tarzı çizim kapışması
                    </p>
                  </div>
                </div>

                <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-xs font-bold border border-amber-200 dark:border-amber-800/60">
                  {drawguessRoomCount} Oda Aktif
                </span>
              </div>

              {/* Visual preview mini drawing tools */}
              <div className="flex items-center gap-2 py-2">
                <div className="w-8 h-10 rounded-lg bg-amber-500 text-white flex items-center justify-center font-black text-xs shadow-sm">
                  ✏️
                </div>
                <div className="w-8 h-10 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-black text-xs shadow-sm">
                  🎨
                </div>
                <div className="w-8 h-10 rounded-lg bg-sky-500 text-white flex items-center justify-center font-black text-xs shadow-sm">
                  💡
                </div>
                <div className="w-8 h-10 rounded-lg bg-fuchsia-500 text-white flex items-center justify-center font-black text-xs shadow-sm">
                  🏆
                </div>
              </div>

              {/* Feature bullets */}
              <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span><strong>HTML5 Dokunmatik Tuval:</strong> Renkler, kalınlıklar, silgi & temizleme</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span><strong>Canlı Süre & Kelime Seçimi:</strong> Kolay, orta ve zor seviyeli kelimeler</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span><strong>Eğlence Modu:</strong> Sıralama tablosundan bağımsız parti oyunu</span>
                </li>
              </ul>
            </div>

            {/* Action footer */}
            <div className="p-5 bg-slate-50 dark:bg-slate-900/70 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Users size={14} /> 2-10 Oyuncu
              </span>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 group-hover:bg-amber-500 text-white font-bold text-xs transition-colors shadow-md shadow-amber-900/20">
                Çizim Lobisine Gir <ChevronRight size={16} />
              </div>
            </div>
          </div>

        </div>

        {/* --- PERFORMANCE-FRIENDLY LEADERBOARD --- */}
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
          {/* Header & Tabs */}
          <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 flex items-center justify-center">
                <Trophy size={22} />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
                  Liderlik Sıralaması (Top 10)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Oyunlarda en çok galibiyet alan şampiyonlar
                </p>
              </div>
            </div>

            {/* Tab Controls & Refresh */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-auto">
                <button
                  onClick={() => setLeaderboardTab('okey')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    leaderboardTab === 'okey'
                      ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <span>🀄</span>
                  <span>Okey Sıralaması</span>
                </button>
                <button
                  onClick={() => setLeaderboardTab('uno')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    leaderboardTab === 'uno'
                      ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <span>🎴</span>
                  <span>UNO Sıralaması</span>
                </button>
              </div>

              <button
                onClick={() => fetchLeaderboard(leaderboardTab)}
                disabled={loadingLeaderboard}
                title="Sıralamayı Güncelle"
                className="p-2.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              >
                <RefreshCw size={16} className={loadingLeaderboard ? 'animate-spin text-blue-500' : ''} />
              </button>
            </div>
          </div>

          {/* Leaderboard Content */}
          <div className="p-4 sm:p-6">
            {loadingLeaderboard && leaderboardData.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">
                Sıralama yükleniyor...
              </div>
            ) : leaderboardData.length === 0 ? (
              <div className="text-center py-10 text-slate-400 dark:text-slate-500">
                <Trophy size={40} className="mx-auto mb-2 opacity-30 text-amber-500" />
                <p className="font-semibold text-sm">Henüz kayıtlı galibiyet bulunmuyor.</p>
                <p className="text-xs text-slate-400 mt-1">İlk masayı sen kur ve zirveye yerleş!</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {leaderboardData.map((userRow, index) => {
                  const rank = index + 1;
                  const isTop1 = rank === 1;
                  const isTop2 = rank === 2;
                  const isTop3 = rank === 3;
                  const wins = leaderboardTab === 'uno' ? (userRow.uno_wins || 0) : (userRow.okey_wins || 0);
                  const isMe = userRow.id === currentUserId;

                  return (
                    <div
                      key={userRow.id}
                      onClick={() => onUserClick && onUserClick(userRow.id)}
                      className={`flex items-center justify-between p-3 sm:p-4 rounded-2xl transition-all duration-200 cursor-pointer ${
                        isTop1
                          ? 'bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/30 hover:border-amber-500/60 shadow-sm'
                          : isTop2
                          ? 'bg-gradient-to-r from-slate-300/20 dark:from-slate-700/30 via-slate-200/5 to-transparent border border-slate-300 dark:border-slate-700 hover:border-slate-400'
                          : isTop3
                          ? 'bg-gradient-to-r from-amber-700/15 via-orange-600/5 to-transparent border border-amber-700/30 hover:border-amber-700/50'
                          : 'bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {/* Left: Rank & Avatar & Name */}
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        {/* Rank Badge */}
                        <div className="w-8 sm:w-10 flex items-center justify-center shrink-0">
                          {isTop1 ? (
                            <div className="flex flex-col items-center">
                              <Crown size={18} className="text-amber-500 drop-shadow animate-bounce" />
                              <span className="text-xs font-black text-amber-600 dark:text-amber-400">1</span>
                            </div>
                          ) : isTop2 ? (
                            <div className="flex flex-col items-center">
                              <Medal size={17} className="text-slate-400 dark:text-slate-300" />
                              <span className="text-xs font-black text-slate-600 dark:text-slate-300">2</span>
                            </div>
                          ) : isTop3 ? (
                            <div className="flex flex-col items-center">
                              <Medal size={17} className="text-amber-700 dark:text-amber-500" />
                              <span className="text-xs font-black text-amber-700 dark:text-amber-500">3</span>
                            </div>
                          ) : (
                            <span className="text-sm font-bold text-slate-400 dark:text-slate-500">
                              #{rank}
                            </span>
                          )}
                        </div>

                        {/* Avatar */}
                        <div className="relative shrink-0">
                          <Avatar
                            url={userRow.avatar}
                            name={userRow.username}
                            color={userRow.color || undefined}
                            size={10}
                          />
                          {isTop1 && (
                            <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] shadow-sm font-bold border-2 border-white dark:border-slate-900">
                              👑
                            </div>
                          )}
                        </div>

                        {/* Username */}
                        <div className="min-w-0 truncate">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold text-sm sm:text-base truncate ${
                              isTop1
                                ? 'text-amber-700 dark:text-amber-300'
                                : isTop2
                                ? 'text-slate-800 dark:text-slate-200'
                                : isTop3
                                ? 'text-amber-900 dark:text-amber-400'
                                : 'text-slate-700 dark:text-slate-300'
                            }`}>
                              {userRow.username}
                            </span>
                            {isMe && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-300">
                                Sen
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500">
                            {isTop1 ? '🏆 1. Sıra Şampiyonu' : isTop2 ? '🥈 2. Sıra Finalisti' : isTop3 ? '🥉 3. Sıra Derecesi' : `${rank}. Sıra`}
                          </span>
                        </div>
                      </div>

                      {/* Right: Win Counter */}
                      <div className="shrink-0 pl-3">
                        <div className={`px-3 py-1.5 rounded-xl font-extrabold text-xs sm:text-sm flex items-center gap-1.5 ${
                          isTop1
                            ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                            : isTop2
                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                            : isTop3
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}>
                          <span>{wins}</span>
                          <span className="text-[11px] font-medium opacity-90 hidden sm:inline">Galibiyet</span>
                          <span className="text-[11px] font-medium opacity-90 sm:hidden">G</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Safety & Stats banner */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-emerald-500 shrink-0" size={18} />
            <span>Kesintisiz bağlantı garantisi: Ağ dalgalanmasında 20 saniye otomatik yeniden bağlanma desteği aktiftir.</span>
          </div>
          <div className="flex items-center gap-4 shrink-0 font-semibold text-slate-700 dark:text-slate-300">
            <span>🀄 Klasik Okey</span>
            <span>💯 101 Okey</span>
            <span>🎴 Resmi UNO</span>
            <span>🎨 Çiz Bakalım</span>
          </div>
        </div>

      </div>
    </div>
  );
}
