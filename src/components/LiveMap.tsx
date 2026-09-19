import React, { useEffect, useRef, useState, useCallback } from "react";
import { Socket } from "socket.io-client";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { 
  MapPin, 
  Navigation, 
  Eye, 
  EyeOff, 
  Crosshair, 
  Users, 
  ShieldAlert, 
  CheckCircle2, 
  Layers, 
  UserCircle2, 
  MessageCircle, 
  ExternalLink,
  Sparkles,
  Info
} from "lucide-react";

export interface UserLiveLocation {
  userId: number;
  username: string;
  avatar: string | null;
  color: string;
  lat: number;
  lng: number;
  status?: string;
  updatedAt?: number;
}

interface LiveMapProps {
  socket: Socket | null;
  currentUserId: number;
  username: string;
  avatar: string | null;
  color?: string;
  onUserClick: (userId: number) => void;
  onOpenChat?: (userId: number) => void;
}

export default function LiveMap({
  socket,
  currentUserId,
  username,
  avatar,
  color,
  onUserClick,
  onOpenChat
}: LiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<Map<number, L.Marker>>(new Map());
  const watchIdRef = useRef<number | null>(null);

  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [permissionStatus, setPermissionStatus] = useState<"prompt" | "granted" | "denied">("prompt");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [myCoords, setMyCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [usersLocations, setUsersLocations] = useState<UserLiveLocation[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserLiveLocation | null>(null);
  const [showUsersPanel, setShowUsersPanel] = useState<boolean>(false);

  // Standard 100% Free OpenStreetMap Tile Server (No API key or watermark required)
  const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  // Helper to create custom HTML Marker Icon
  const createCustomMarkerIcon = useCallback((user: UserLiveLocation, isMe: boolean) => {
    const isCurrentUser = isMe || user.userId === currentUserId;
    const ringColor = isCurrentUser ? "#3b82f6" : (user.color || "#10b981");
    const glowColor = isCurrentUser ? "rgba(59, 130, 246, 0.45)" : "rgba(16, 185, 129, 0.45)";
    const initial = (user.username?.[0] || "U").toUpperCase();

    const avatarHtml = user.avatar
      ? `<img src="${user.avatar}" alt="${user.username}" class="w-full h-full object-cover rounded-full" />`
      : `<div class="w-full h-full flex items-center justify-center rounded-full text-white font-bold text-xs" style="background-color: ${user.color || '#6366f1'}">${initial}</div>`;

    const html = `
      <div class="relative flex items-center justify-center group cursor-pointer" style="width: 48px; height: 48px;">
        <!-- Glowing Pulse Radar Effect -->
        <div class="absolute inset-0 rounded-full animate-ping opacity-60" style="background-color: ${glowColor};"></div>
        <div class="absolute inset-1 rounded-full animate-pulse opacity-40" style="background-color: ${ringColor};"></div>
        
        <!-- Main Avatar Circle -->
        <div class="relative z-10 w-10 h-10 rounded-full p-0.5 shadow-xl border-2 transition-transform duration-200 transform hover:scale-110" 
             style="background-color: #0f172a; border-color: ${ringColor}; box-shadow: 0 0 14px ${glowColor};">
          <div class="w-full h-full rounded-full overflow-hidden bg-slate-800">
            ${avatarHtml}
          </div>
          ${isCurrentUser ? '<div class="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-slate-900 flex items-center justify-center text-[8px] font-black text-white">★</div>' : ''}
        </div>

        <!-- Floating Username Tag -->
        <div class="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-semibold text-white shadow-md backdrop-blur-md pointer-events-none transition-all"
             style="background-color: rgba(15, 23, 42, 0.9); border: 1px solid rgba(255,255,255,0.15);">
          ${isCurrentUser ? 'Siz' : user.username}
        </div>
      </div>
    `;

    return L.divIcon({
      className: "custom-leaflet-pin",
      html,
      iconSize: [48, 48],
      iconAnchor: [24, 24],
      popupAnchor: [0, -26]
    });
  }, [currentUserId]);

  // Create Popup Content
  const createPopupContent = useCallback((user: UserLiveLocation, isMe: boolean) => {
    const isCurrentUser = isMe || user.userId === currentUserId;
    const initial = (user.username?.[0] || "U").toUpperCase();
    const avatarHtml = user.avatar
      ? `<img src="${user.avatar}" class="w-11 h-11 rounded-full object-cover border-2 border-slate-700" />`
      : `<div class="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base" style="background-color: ${user.color || '#6366f1'}">${initial}</div>`;

    const statusText = user.status || "Aktif Çevrimiçi";
    const statusColor = user.status?.includes("Okey") ? "#f59e0b" : user.status?.includes("UNO") ? "#ef4444" : user.status?.includes("Çiz") ? "#8b5cf6" : "#10b981";

    const container = document.createElement("div");
    container.className = "p-3 bg-slate-900 text-slate-100 rounded-2xl border border-slate-700 shadow-2xl min-w-[210px]";
    container.innerHTML = `
      <div class="flex items-center gap-3 mb-2.5">
        ${avatarHtml}
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5">
            <h4 class="font-bold text-sm text-white truncate">${user.username}</h4>
            ${isCurrentUser ? '<span class="text-[10px] bg-blue-500/20 text-blue-400 font-semibold px-1.5 py-0.2 rounded-full border border-blue-500/30">Siz</span>' : ''}
          </div>
          <div class="flex items-center gap-1.5 text-xs text-slate-300 mt-0.5">
            <span class="w-2 h-2 rounded-full" style="background-color: ${statusColor}"></span>
            <span class="truncate">${statusText}</span>
          </div>
        </div>
      </div>
      
      <div class="text-[10px] text-slate-400 mb-2.5 flex items-center justify-between border-t border-slate-800 pt-2">
        <span>Koordinat:</span>
        <span class="font-mono text-slate-300">${user.lat.toFixed(4)}, ${user.lng.toFixed(4)}</span>
      </div>

      <div class="flex gap-2">
        <button id="btn-popup-profile-${user.userId}" class="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-1">
          <span>Profil</span>
        </button>
        ${!isCurrentUser ? `
          <button id="btn-popup-chat-${user.userId}" class="flex-1 py-1.5 px-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1 shadow-md shadow-blue-600/30">
            <span>Mesaj</span>
          </button>
        ` : ''}
      </div>
    `;

    // Attach event handlers
    setTimeout(() => {
      const btnProfile = document.getElementById(`btn-popup-profile-${user.userId}`);
      if (btnProfile) {
        btnProfile.onclick = (e) => {
          e.stopPropagation();
          onUserClick(user.userId);
        };
      }
      const btnChat = document.getElementById(`btn-popup-chat-${user.userId}`);
      if (btnChat && onOpenChat) {
        btnChat.onclick = (e) => {
          e.stopPropagation();
          onOpenChat(user.userId);
        };
      }
    }, 50);

    return container;
  }, [currentUserId, onUserClick, onOpenChat]);

  // Stop location sharing
  const stopLocationSharing = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsSharing(false);
    setIsLocating(false);
    setMyCoords(null);

    // Remove current user marker from local map
    const myMarker = markersRef.current.get(currentUserId);
    if (myMarker && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(myMarker);
      markersRef.current.delete(currentUserId);
    }

    // Inform server
    if (socket) {
      socket.emit("stop_sharing_location");
    }
  }, [socket, currentUserId]);

  // Start high-accuracy location tracking
  const startLocationSharing = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError("Tarayıcınız konum servisini (Geolocation API) desteklemiyor.");
      return;
    }

    setIsLocating(true);
    setGeoError(null);

    const geoOptions: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    // First do a one-shot fetch for rapid response
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setMyCoords({ lat: latitude, lng: longitude });
        setIsSharing(true);
        setIsLocating(false);
        setPermissionStatus("granted");

        // Center map on user
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([latitude, longitude], 14, {
            animate: true,
            duration: 1.2
          });
        }

        // Share with server
        if (socket) {
          socket.emit("share_location", { lat: latitude, lng: longitude });
        }

        // Setup continuous watcher
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
        }

        watchIdRef.current = navigator.geolocation.watchPosition(
          (watchPos) => {
            const newLat = watchPos.coords.latitude;
            const newLng = watchPos.coords.longitude;
            setMyCoords({ lat: newLat, lng: newLng });
            if (socket) {
              socket.emit("share_location", { lat: newLat, lng: newLng });
            }
          },
          (err) => {
            console.warn("Geolocation watch update error:", err);
          },
          geoOptions
        );
      },
      (err) => {
        setIsLocating(false);
        setIsSharing(false);
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionStatus("denied");
          setGeoError("Konum izni verilmedi; haritayı yalnızca izleyici olarak görüntülüyorsunuz.");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGeoError("Konum bilgisi alınamadı. GPS veya ağ servisinizi kontrol edin.");
        } else if (err.code === err.TIMEOUT) {
          setGeoError("Konum isteği zaman aşımına uğradı. Lütfen tekrar deneyin.");
        } else {
          setGeoError("Konum alınırken bir hata oluştu: " + err.message);
        }
      },
      geoOptions
    );
  }, [socket]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Default center: Turkey / World center
    const defaultCenter: [number, number] = [39.9334, 32.8597]; // Ankara
    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 6,
      zoomControl: false
    });

    // Add zoom control at bottom right
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Initial tile layer: Standard 100% Free OpenStreetMap (No API key / No watermark)
    const tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);

    tileLayerRef.current = tileLayer;
    mapInstanceRef.current = map;

    // Auto-request location on component mount
    startLocationSharing();

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []); // Run once on mount

  // Socket.io Real-time Location synchronization
  useEffect(() => {
    if (!socket) return;

    // Fetch current user locations
    socket.emit("get_user_locations", (locations: UserLiveLocation[]) => {
      if (Array.isArray(locations)) {
        setUsersLocations(locations);
      }
    });

    const handleUpdateUserLocations = (locations: UserLiveLocation[]) => {
      if (Array.isArray(locations)) {
        setUsersLocations(locations);
      }
    };

    socket.on("update_user_locations", handleUpdateUserLocations);

    return () => {
      socket.off("update_user_locations", handleUpdateUserLocations);
    };
  }, [socket]);

  // Sync Markers on Map whenever usersLocations or myCoords change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Prepare complete list of markers to display
    const activeUserIds = new Set<number>();

    // If I have coordinates and isSharing is true, ensure I am in the list
    const combinedList: UserLiveLocation[] = [...usersLocations];
    if (isSharing && myCoords) {
      const existingMyIndex = combinedList.findIndex(u => u.userId === currentUserId);
      const myObj: UserLiveLocation = {
        userId: currentUserId,
        username,
        avatar,
        color: color || "#3b82f6",
        lat: myCoords.lat,
        lng: myCoords.lng,
        status: "Haritada Aktif (Siz)"
      };

      if (existingMyIndex >= 0) {
        combinedList[existingMyIndex] = myObj;
      } else {
        combinedList.push(myObj);
      }
    }

    combinedList.forEach((user) => {
      if (!user.lat || !user.lng) return;
      activeUserIds.add(user.userId);
      const isMe = user.userId === currentUserId;

      const existingMarker = markersRef.current.get(user.userId);
      const icon = createCustomMarkerIcon(user, isMe);
      const popupContent = createPopupContent(user, isMe);

      if (existingMarker) {
        // Smoothly update position and icon
        existingMarker.setLatLng([user.lat, user.lng]);
        existingMarker.setIcon(icon);
        existingMarker.setPopupContent(popupContent);
      } else {
        // Create new Leaflet Marker
        const marker = L.marker([user.lat, user.lng], { icon })
          .addTo(map)
          .bindPopup(popupContent, {
            className: "custom-leaflet-popup",
            closeButton: false,
            offset: [0, -10]
          });

        marker.on("click", () => {
          setSelectedUser(user);
        });

        markersRef.current.set(user.userId, marker);
      }
    });

    // Remove markers for users who stopped sharing or left
    markersRef.current.forEach((marker, uid) => {
      if (!activeUserIds.has(uid)) {
        map.removeLayer(marker);
        markersRef.current.delete(uid);
      }
    });
  }, [usersLocations, myCoords, isSharing, currentUserId, username, avatar, color, createCustomMarkerIcon, createPopupContent]);

  // Center on user's own location
  const handleCenterOnMe = () => {
    if (myCoords && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([myCoords.lat, myCoords.lng], 15, {
        animate: true,
        duration: 1.2
      });
    } else {
      startLocationSharing();
    }
  };

  // Focus on specific user
  const handleFocusUser = (u: UserLiveLocation) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([u.lat, u.lng], 15, {
        animate: true,
        duration: 1.2
      });
      const marker = markersRef.current.get(u.userId);
      if (marker) {
        marker.openPopup();
      }
      setShowUsersPanel(false);
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950 overflow-hidden select-none">
      {/* Top Floating Control Bar */}
      <div className="absolute top-3 inset-x-3 z-[1000] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Title & Live Presence Indicator */}
        <div className="flex items-center gap-2.5 bg-slate-900/90 border border-slate-700/80 backdrop-blur-xl px-3.5 py-2 rounded-2xl shadow-xl pointer-events-auto">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
            <MapPin size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              Canlı Harita
              <span className="flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-400 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Anlık Senkron
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              {usersLocations.length + (isSharing && !usersLocations.some(u => u.userId === currentUserId) ? 1 : 0)} Kullanıcı Konum Paylaşıyor
            </p>
          </div>
        </div>

        {/* Right: Actions, Privacy Toggle & User List */}
        <div className="flex items-center gap-2 pointer-events-auto flex-wrap">
          {/* Active Users List Drawer Toggle */}
          <button
            onClick={() => setShowUsersPanel(!showUsersPanel)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl border backdrop-blur-xl text-xs font-semibold shadow-xl transition-all ${
              showUsersPanel
                ? "bg-indigo-600 border-indigo-500 text-white"
                : "bg-slate-900/90 border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Users size={15} />
            <span className="hidden sm:inline">Kişiler</span>
            <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">
              {usersLocations.length + (isSharing && !usersLocations.some(u => u.userId === currentUserId) ? 1 : 0)}
            </span>
          </button>

          {/* Privacy & Location Sharing Toggle Button */}
          {isSharing ? (
            <button
              onClick={stopLocationSharing}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-xl shadow-red-600/30 border border-red-500 transition-all hover:scale-105 active:scale-95"
              title="Konumunuzu başkalarından gizleyin"
            >
              <EyeOff size={15} />
              <span>Paylaşımı Durdur</span>
            </button>
          ) : (
            <button
              onClick={startLocationSharing}
              disabled={isLocating}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xl shadow-blue-600/30 border border-blue-500 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              title="Konumunuzu diğer kullanıcılara gösterin"
            >
              <Navigation size={15} className={isLocating ? "animate-spin" : ""} />
              <span>{isLocating ? "Konum Alınıyor..." : "Konumumu Paylaş"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Permission Denied / Error Notification Banner */}
      {geoError && (
        <div className="absolute top-20 inset-x-3 z-[1000] max-w-xl mx-auto p-3 bg-amber-950/90 border border-amber-600/80 text-amber-200 rounded-2xl backdrop-blur-xl shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-top-3">
          <div className="flex items-center gap-2.5 text-xs">
            <ShieldAlert size={18} className="text-amber-400 shrink-0" />
            <p className="leading-snug">{geoError}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={startLocationSharing}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-semibold rounded-xl transition-colors shadow"
            >
              Tekrar Dene
            </button>
            <button
              onClick={() => setGeoError(null)}
              className="text-amber-400 hover:text-white p-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Active Users Slide-in Side Panel */}
      {showUsersPanel && (
        <div className="absolute top-20 right-3 z-[1000] w-72 max-h-[70vh] bg-slate-900/95 border border-slate-700/80 rounded-3xl shadow-2xl backdrop-blur-xl p-3.5 flex flex-col gap-2 overflow-hidden animate-in slide-in-from-right-2">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Users size={14} className="text-indigo-400" />
              Haritadaki Kullanıcılar
            </h3>
            <button 
              onClick={() => setShowUsersPanel(false)}
              className="text-slate-400 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 py-1">
            {/* Myself */}
            {isSharing && myCoords && (
              <div 
                onClick={handleCenterOnMe}
                className="p-2.5 rounded-2xl bg-blue-900/30 border border-blue-700/50 hover:bg-blue-900/50 cursor-pointer transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white shadow">
                    {avatar ? (
                      <img src={avatar} alt={username} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      username[0]?.toUpperCase() || "S"
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-white truncate">{username}</span>
                      <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1 py-0.2 rounded font-semibold">Siz</span>
                    </div>
                    <span className="text-[10px] text-blue-300">Canlı Paylaşılıyor</span>
                  </div>
                </div>
                <Crosshair size={14} className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}

            {/* Other Users */}
            {usersLocations.filter(u => u.userId !== currentUserId).map((user) => (
              <div
                key={user.userId}
                onClick={() => handleFocusUser(user)}
                className="p-2.5 rounded-2xl bg-slate-800/60 border border-slate-700/50 hover:bg-slate-800 cursor-pointer transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow"
                    style={{ backgroundColor: user.color || "#10b981" }}
                  >
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.username} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      user.username[0]?.toUpperCase() || "U"
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-white truncate block">{user.username}</span>
                    <span className="text-[10px] text-slate-400 truncate block">{user.status || "Çevrimiçi"}</span>
                  </div>
                </div>
                <Navigation size={14} className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}

            {!isSharing && usersLocations.filter(u => u.userId !== currentUserId).length === 0 && (
              <div className="p-4 text-center text-slate-400 text-xs">
                Şu anda haritada konum paylaşan başka kullanıcı bulunmuyor.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Center on Me Floating FAB Button */}
      <div className="absolute bottom-6 right-6 z-[1000] flex flex-col gap-2 pointer-events-auto">
        <button
          onClick={handleCenterOnMe}
          className="w-12 h-12 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white shadow-2xl shadow-blue-600/50 border border-blue-400 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
          title="Beni Haritada Ortala"
        >
          <Crosshair size={22} />
        </button>
      </div>

      {/* Main Full-Screen Leaflet Map DOM Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-0 relative" />

      {/* Bottom Floating Info Pill */}
      <div className="absolute bottom-4 left-4 z-[1000] pointer-events-none hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 text-[11px] backdrop-blur-md">
        <Info size={13} className="text-blue-400" />
        <span>Konumlar yalnızca anlık oturum boyunca bellekte tutulur, veritabanına kaydedilmez.</span>
      </div>
    </div>
  );
}
