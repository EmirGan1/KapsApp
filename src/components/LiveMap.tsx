import React, { useEffect, useRef, useState, useCallback } from "react";
import { Socket } from "socket.io-client";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { 
  MapPin, 
  Navigation, 
  EyeOff, 
  Crosshair, 
  Users, 
  ShieldAlert, 
  MessageSquare,
  User as UserIcon
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
  isLocationActive?: boolean;
  lastSeen?: number;
}

function formatLastSeen(lastSeen?: number): string {
  if (!lastSeen) return "Bilinmiyor";
  const date = new Date(lastSeen);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const timeStr = `${hours}:${minutes}`;
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - lastSeen) / 1000));
  if (diffSec < 60) return `${timeStr} (Az önce)`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${timeStr} (${diffMin} dk önce)`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${timeStr} (${diffHours} sa önce)`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return `Dün ${timeStr}`;
  return `${diffDays} gün önce ${timeStr}`;
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
  const markersRef = useRef<Map<number, L.Marker>>(new Map());
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);

  const [isSharing, setIsSharing] = useState<boolean>(() => {
    const stored = localStorage.getItem("location_service_enabled");
    if (stored === "true") return true;
    if (stored === "false") return false;
    return localStorage.getItem("isLocationActive") === "true";
  });
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [myCoords, setMyCoords] = useState<{ lat: number; lng: number } | null>(() => {
    try {
      const saved = localStorage.getItem("last_known_coords");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });
  const [usersLocations, setUsersLocations] = useState<UserLiveLocation[]>([]);
  const [showUsersPanel, setShowUsersPanel] = useState<boolean>(false);

  // Helper to create compact HTML Marker Icon with Active/Passive (Silik) Visual Styles
  const createCustomMarkerIcon = useCallback((user: UserLiveLocation, isMe: boolean) => {
    const isCurrentUser = isMe || user.userId === currentUserId;
    const isActive = user.isLocationActive !== false;
    
    const ringColor = isActive 
      ? (isCurrentUser ? "#3b82f6" : (user.color || "#10b981"))
      : "#64748b";
    
    const glowColor = isActive
      ? (isCurrentUser ? "rgba(59, 130, 246, 0.45)" : "rgba(16, 185, 129, 0.45)")
      : "transparent";

    const initial = (user.username?.[0] || "U").toUpperCase();

    const avatarHtml = user.avatar
      ? `<img src="${user.avatar}" alt="${user.username}" class="w-full h-full object-cover rounded-full pointer-events-none ${!isActive ? 'grayscale opacity-75' : ''}" />`
      : `<div class="w-full h-full flex items-center justify-center rounded-full text-white font-bold text-xs pointer-events-none" style="background-color: ${isActive ? (user.color || '#6366f1') : '#475569'};">${initial}</div>`;

    const html = `
      <div class="relative flex items-center justify-center pointer-events-auto" 
           style="width: 48px; height: 48px; ${!isActive ? 'opacity: 0.55; filter: grayscale(85%);' : 'opacity: 1; filter: none;'} transition: all 0.3s ease;">
        ${isActive ? `
          <!-- Pulsing Radar Glow for Active Live Users -->
          <div class="absolute inset-0 rounded-full animate-ping opacity-50 pointer-events-none" style="background-color: ${glowColor};"></div>
          <div class="absolute inset-1 rounded-full animate-pulse opacity-30 pointer-events-none" style="background-color: ${ringColor};"></div>
        ` : ''}
        
        <!-- Avatar Circle (Fixed & Non-draggable) -->
        <div class="relative z-10 w-10 h-10 rounded-full p-0.5 shadow-xl border-2 transition-transform duration-200 hover:scale-110" 
             style="background-color: #0f172a; border-color: ${ringColor}; ${isActive ? `box-shadow: 0 0 14px ${glowColor};` : 'box-shadow: 0 2px 4px rgba(0,0,0,0.5);'}">
          <div class="w-full h-full rounded-full overflow-hidden bg-slate-800">
            ${avatarHtml}
          </div>
          ${isCurrentUser ? `
            <div class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ${isActive ? 'bg-blue-500' : 'bg-slate-600'} rounded-full border border-slate-900 flex items-center justify-center text-[7px] font-black text-white">
              ★
            </div>
          ` : (
            !isActive 
              ? '<div class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-slate-600 rounded-full border border-slate-900 flex items-center justify-center text-[7px] text-slate-300">✕</div>' 
              : '<div class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border border-slate-900"></div>'
          )}
        </div>

        <!-- Floating Username Label -->
        <div class="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.2 rounded-md text-[10px] font-semibold shadow-md pointer-events-none ${
          !isActive ? 'bg-slate-800/90 text-slate-400 border border-slate-700/60' : 'bg-slate-900/90 text-white border border-white/10'
        }">
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

  // Create Popup Content with Lightweight Native DOM & Tailwind Classes
  const createPopupContent = useCallback((user: UserLiveLocation, isMe: boolean) => {
    const isCurrentUser = isMe || user.userId === currentUserId;
    const isActive = user.isLocationActive !== false;
    const initial = (user.username?.[0] || "U").toUpperCase();
    
    const avatarHtml = user.avatar
      ? `<img src="${user.avatar}" class="w-10 h-10 rounded-full object-cover border-2 ${isActive ? 'border-slate-700' : 'border-slate-600 grayscale opacity-75'}" />`
      : `<div class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${!isActive ? 'grayscale opacity-75 bg-slate-600' : ''}" style="${isActive ? `background-color: ${user.color || '#6366f1'}` : ''}">${initial}</div>`;

    const statusText = isActive 
      ? (user.status || "Aktif Çevrimiçi")
      : `Son Görülme: ${formatLastSeen(user.lastSeen || user.updatedAt)}`;

    const statusColor = isActive
      ? (user.status?.includes("Okey") ? "#f59e0b" : user.status?.includes("UNO") ? "#ef4444" : user.status?.includes("Çiz") ? "#8b5cf6" : "#10b981")
      : "#94a3b8";

    const container = document.createElement("div");
    container.className = "p-3 bg-slate-900 text-slate-100 rounded-2xl border border-slate-700/80 shadow-2xl min-w-[200px] select-none";
    container.innerHTML = `
      <div class="flex items-center gap-2.5 mb-2">
        ${avatarHtml}
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5">
            <h4 class="font-bold text-xs text-white truncate">${user.username}</h4>
            ${isCurrentUser ? '<span class="text-[9px] bg-blue-500/20 text-blue-400 font-semibold px-1.5 py-0.2 rounded-full border border-blue-500/30">Siz</span>' : ''}
          </div>
          <div class="flex items-center gap-1.5 text-[11px] text-slate-300 mt-0.5">
            <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background-color: ${statusColor}"></span>
            <span class="truncate ${!isActive ? 'text-slate-400 font-medium' : 'text-slate-200'}">${statusText}</span>
          </div>
        </div>
      </div>
      
      <div class="text-[9px] text-slate-400 mb-2.5 flex items-center justify-between border-t border-slate-800 pt-1.5 font-mono">
        <span class="text-slate-500">Konum:</span>
        <span class="text-slate-300">${user.lat.toFixed(4)}, ${user.lng.toFixed(4)}</span>
      </div>

      <div class="flex gap-1.5">
        <button class="btn-popup-profile flex-1 py-1 px-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-1 cursor-pointer">
          <svg class="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          <span>Profil</span>
        </button>
        ${!isCurrentUser ? `
          <button class="btn-popup-chat flex-1 py-1 px-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1 shadow-md shadow-blue-600/30 cursor-pointer">
            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            <span>Mesaj</span>
          </button>
        ` : ''}
      </div>
    `;

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);

    const btnProfile = container.querySelector(".btn-popup-profile");
    if (btnProfile) {
      btnProfile.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        onUserClick(user.userId);
      });
    }

    const btnChat = container.querySelector(".btn-popup-chat");
    if (btnChat && onOpenChat) {
      btnChat.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        onOpenChat(user.userId);
      });
    }

    return container;
  }, [currentUserId, onUserClick, onOpenChat]);

  // Stop location sharing: Keeps the marker at last known coordinates, emits passive event, and marks as inactive/silik
  const stopLocationSharing = useCallback((isError = false) => {
    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
    setIsSharing(false);
    setIsLocating(false);
    localStorage.setItem("location_service_enabled", "false");
    localStorage.setItem("isLocationActive", "false");

    const lastSeenTime = Date.now();
    const payload = {
      userId: currentUserId,
      lastLat: myCoords?.lat,
      lastLng: myCoords?.lng,
      lastSeen: lastSeenTime
    };

    if (socket) {
      socket.emit("stop_sharing_location", payload);
      socket.emit("location:disabled", payload);
      socket.emit("user:passive", payload);
    }

    // Update current user's local state to passive mode without deleting marker
    setUsersLocations((prev) => {
      const idx = prev.findIndex((u) => u.userId === currentUserId);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          isLocationActive: false,
          status: isError ? "Konum İzni Yok" : "Konum Kapalı",
          lastSeen: lastSeenTime
        };
        return updated;
      } else if (myCoords) {
        return [
          ...prev,
          {
            userId: currentUserId,
            username,
            avatar,
            color: color || "#3b82f6",
            lat: myCoords.lat,
            lng: myCoords.lng,
            status: isError ? "Konum İzni Yok" : "Konum Kapalı",
            isLocationActive: false,
            lastSeen: lastSeenTime
          }
        ];
      }
      return prev;
    });
  }, [socket, currentUserId, myCoords, username, avatar, color]);

  // High-accuracy Automated Geolocation fetch
  const fetchAndSendPosition = useCallback((shouldFlyTo: boolean = false) => {
    if (!navigator.geolocation) {
      console.warn("Tarayıcınız konum servisini (Geolocation API) desteklemiyor.");
      setIsLocating(false);
      setGeoError("Tarayıcınız Geolocation API desteklemiyor.");
      stopLocationSharing(true);
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const coords = { lat: latitude, lng: longitude };
        setMyCoords(coords);
        try {
          localStorage.setItem("last_known_coords", JSON.stringify(coords));
        } catch (e) {}

        setIsSharing(true);
        setIsLocating(false);
        setGeoError(null);

        if (shouldFlyTo && mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([latitude, longitude], 14, {
            animate: true,
            duration: 1.2
          });
        }

        if (socket) {
          socket.emit("update_user_location", { lat: latitude, lng: longitude });
          socket.emit("share_location", { lat: latitude, lng: longitude });
        }
      },
      (err) => {
        console.warn("Konum izni alınamadı:", err.message);
        setIsLocating(false);
        if (err.code === 1) { // PERMISSION_DENIED
          setGeoError("Konum erişimi kapalı veya tarayıcı izni reddedildi.");
        } else if (err.code === 2) {
          setGeoError("Konum bilgisi alınamadı (GPS kapalı veya sinyal yok).");
        } else {
          setGeoError("Konum zaman aşımına uğradı.");
        }
        stopLocationSharing(true);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 60000
      }
    );
  }, [socket, stopLocationSharing]);

  // Start periodic tracking (1-minute periodic GPS update)
  const startLocationSharing = useCallback(() => {
    setIsLocating(true);
    setGeoError(null);
    localStorage.setItem("location_service_enabled", "true");
    localStorage.setItem("isLocationActive", "true");
    setIsSharing(true);

    fetchAndSendPosition(true);

    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
    }

    // Refresh position periodically every 1 minute (60,000 ms)
    intervalIdRef.current = setInterval(() => {
      fetchAndSendPosition(false);
    }, 60000);
  }, [fetchAndSendPosition]);

  // Handle beforeunload and visibilitychange for clean offline state
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (socket && (isSharing || myCoords)) {
        const payload = {
          userId: currentUserId,
          lastLat: myCoords?.lat,
          lastLng: myCoords?.lng,
          lastSeen: Date.now()
        };
        socket.emit("stop_sharing_location", payload);
        socket.emit("location:disabled", payload);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [socket, isSharing, myCoords, currentUserId]);

  // Initialize Leaflet Map with touch and resize optimizations
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Default center Istanbul / Turkey coordinate or user's last known location
    const defaultCenter: [number, number] = myCoords ? [myCoords.lat, myCoords.lng] : [41.0082, 28.9784];
    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: myCoords ? 14 : 11,
      zoomControl: false,
      attributionControl: false
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    mapInstanceRef.current = map;

    // Trigger initial size calculation right after render
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 400);

    // ResizeObserver to automatically handle mobile address bar toggle / desktop resize
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    // Check saved state: Only auto-start if explicitly set to true
    const savedEnabled = localStorage.getItem("location_service_enabled");
    const legacySaved = localStorage.getItem("isLocationActive");
    const isLocationOn = savedEnabled === "true" || (savedEnabled === null && legacySaved === "true");

    if (isLocationOn) {
      startLocationSharing();
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      resizeObserver.disconnect();
      if (intervalIdRef.current !== null) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [startLocationSharing]);

  // Socket.io Real-time Location synchronization
  useEffect(() => {
    if (!socket) return;

    const handleUpdateUserLocations = (locations: UserLiveLocation[]) => {
      if (Array.isArray(locations)) {
        setUsersLocations(locations);
      }
    };

    const handleLocationStatus = (data: {
      userId: number;
      isLive?: boolean;
      isLocationActive?: boolean;
      lastSeen?: number;
      lat?: number;
      lng?: number;
      status?: string;
    }) => {
      if (!data || !data.userId) return;
      setUsersLocations((prev) => {
        const index = prev.findIndex((u) => u.userId === data.userId);
        const isLive = data.isLocationActive !== undefined ? data.isLocationActive : data.isLive;
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            isLocationActive: isLive,
            lastSeen: data.lastSeen || updated[index].lastSeen,
            status: data.status || (isLive ? "Aktif Çevrimiçi" : "Konum Kapalı"),
            lat: data.lat ?? updated[index].lat,
            lng: data.lng ?? updated[index].lng
          };
          return updated;
        }
        return prev;
      });
    };

    socket.on("update_user_locations", handleUpdateUserLocations);
    socket.on("all_user_locations", handleUpdateUserLocations);
    socket.on("user:location_status", handleLocationStatus);

    socket.emit("request_all_locations");

    return () => {
      socket.off("update_user_locations", handleUpdateUserLocations);
      socket.off("all_user_locations", handleUpdateUserLocations);
      socket.off("user:location_status", handleLocationStatus);
    };
  }, [socket]);

  // Incremental Marker Sync (Strictly Non-Draggable, High Performance, Preserves Passive Markers)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const activeUserIds = new Set<number>();
    const combinedList: UserLiveLocation[] = [...usersLocations];

    // Merge or update current user's location pin
    const selfIndex = combinedList.findIndex(u => u.userId === currentUserId);
    if (myCoords) {
      const myObj: UserLiveLocation = {
        userId: currentUserId,
        username,
        avatar,
        color: color || "#3b82f6",
        lat: myCoords.lat,
        lng: myCoords.lng,
        status: isSharing ? "Haritada Aktif (Siz)" : "Konum Kapalı (Siz)",
        isLocationActive: isSharing,
        lastSeen: selfIndex >= 0 && !isSharing ? (combinedList[selfIndex].lastSeen || Date.now()) : Date.now()
      };

      if (selfIndex >= 0) {
        combinedList[selfIndex] = myObj;
      } else {
        combinedList.push(myObj);
      }
    }

    combinedList.forEach((user) => {
      if (typeof user.lat !== "number" || typeof user.lng !== "number" || isNaN(user.lat) || isNaN(user.lng)) return;
      activeUserIds.add(user.userId);
      const isMe = user.userId === currentUserId;

      const existingMarker = markersRef.current.get(user.userId);
      const icon = createCustomMarkerIcon(user, isMe);
      const popupContent = createPopupContent(user, isMe);

      if (existingMarker) {
        existingMarker.setLatLng([user.lat, user.lng]);
        existingMarker.setIcon(icon);
        existingMarker.setPopupContent(popupContent);
      } else {
        const marker = L.marker([user.lat, user.lng], { 
          icon,
          draggable: false // Strict constraint: all markers fixed & non-draggable
        })
          .addTo(map)
          .bindPopup(popupContent, {
            className: "custom-leaflet-popup",
            closeButton: false,
            offset: [0, -8]
          });

        markersRef.current.set(user.userId, marker);
      }
    });

    // Clean up markers for users that no longer exist in state or DB
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
      fetchAndSendPosition(true);
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

  const activeCount = usersLocations.filter(u => u.isLocationActive !== false && (u.userId !== currentUserId || isSharing)).length + (isSharing && !usersLocations.some(u => u.userId === currentUserId) ? 1 : 0);
  const totalCount = usersLocations.length + (myCoords && !usersLocations.some(u => u.userId === currentUserId) ? 1 : 0);

  return (
    <div className="relative w-full h-full min-h-0 flex-1 flex flex-col bg-slate-950 overflow-hidden select-none touch-pan-x touch-pan-y">
      {/* Top Floating Control Bar */}
      <div className="absolute top-3 inset-x-3 z-[1000] flex items-center justify-between gap-2 pointer-events-none">
        
        {/* Brand & Online Stats */}
        <div className="flex items-center gap-2.5 bg-slate-900/90 border border-slate-700/80 backdrop-blur-xl px-3.5 py-2 rounded-2xl shadow-xl pointer-events-auto">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
            <MapPin size={18} />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
              Canlı Harita
              <span className="flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-400 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Otomatik
              </span>
            </h2>
            <p className="text-[10px] sm:text-[11px] text-slate-400">
              {activeCount} Aktif · {totalCount} Toplam Pin
            </p>
          </div>
        </div>

        {/* Actions (Users Drawer & Sharing Toggle) */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Active Users List Drawer Toggle */}
          <button
            onClick={() => setShowUsersPanel(!showUsersPanel)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl border backdrop-blur-xl text-xs font-semibold shadow-xl transition-all cursor-pointer ${
              showUsersPanel
                ? "bg-indigo-600 border-indigo-500 text-white"
                : "bg-slate-900/90 border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Users size={15} />
            <span className="hidden sm:inline">Kişiler</span>
            <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">
              {totalCount}
            </span>
          </button>

          {/* Privacy & Location Sharing Toggle Button */}
          {isSharing ? (
            <button
              onClick={() => stopLocationSharing(false)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-xl shadow-red-600/30 border border-red-500 transition-all hover:scale-105 active:scale-95 cursor-pointer"
              title="Konumunuzu başkalarından gizleyin"
            >
              <EyeOff size={15} />
              <span className="hidden sm:inline">Konumu Kapat</span>
            </button>
          ) : (
            <button
              onClick={startLocationSharing}
              disabled={isLocating}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xl shadow-blue-600/30 border border-blue-500 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Konumunuzu diğer kullanıcılara gösterin"
            >
              <Navigation size={15} className={isLocating ? "animate-spin" : ""} />
              <span>{isLocating ? "Alınıyor..." : "Konumu Aç"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Geolocation Permission Info Banner (Auto-dismissable) */}
      {geoError && (
        <div className="absolute top-20 inset-x-3 z-[1000] max-w-md mx-auto p-3 bg-amber-950/90 border border-amber-600/80 text-amber-200 rounded-2xl backdrop-blur-xl shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-top-3">
          <div className="flex items-center gap-2 text-xs">
            <ShieldAlert size={16} className="text-amber-400 shrink-0" />
            <p className="leading-snug">{geoError}</p>
          </div>
          <button
            onClick={() => setGeoError(null)}
            className="text-amber-400 hover:text-white text-xs p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Active Users Slide-in Side Panel */}
      {showUsersPanel && (
        <div className="absolute top-18 right-3 z-[1000] w-72 max-h-[70vh] bg-slate-900/95 border border-slate-700/80 rounded-3xl shadow-2xl backdrop-blur-xl p-3 flex flex-col gap-2 overflow-hidden animate-in slide-in-from-right-2">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Users size={14} className="text-indigo-400" />
              Haritadaki Kullanıcılar ({totalCount})
            </h3>
            <button 
              onClick={() => setShowUsersPanel(false)}
              className="text-slate-400 hover:text-white text-xs cursor-pointer p-1"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar space-y-1.5 py-1">
            {/* Myself */}
            {myCoords && (
              <div 
                onClick={handleCenterOnMe}
                className={`p-2 rounded-2xl border cursor-pointer transition-all flex items-center justify-between group ${
                  isSharing 
                    ? "bg-blue-900/30 border-blue-700/50 hover:bg-blue-900/50" 
                    : "bg-slate-800/40 border-slate-700/40 hover:bg-slate-800/60 opacity-80"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow shrink-0 ${isSharing ? 'bg-blue-600' : 'bg-slate-600 grayscale'}`}>
                    {avatar ? (
                      <img src={avatar} alt={username} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      username[0]?.toUpperCase() || "S"
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-white truncate">{username}</span>
                      <span className={`text-[8px] px-1 py-0.2 rounded font-semibold ${isSharing ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-700 text-slate-400'}`}>Siz</span>
                    </div>
                    <span className={`text-[9px] block truncate ${isSharing ? 'text-blue-300' : 'text-slate-400'}`}>
                      {isSharing ? "Canlı Paylaşılıyor" : "Konum Kapalı"}
                    </span>
                  </div>
                </div>
                <Crosshair size={13} className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1" />
              </div>
            )}

            {/* Other Users */}
            {usersLocations.filter(u => u.userId !== currentUserId).map((user) => {
              const isActive = user.isLocationActive !== false;
              return (
                <div
                  key={user.userId}
                  onClick={() => handleFocusUser(user)}
                  className={`p-2 rounded-2xl border cursor-pointer transition-all flex items-center justify-between group ${
                    isActive 
                      ? "bg-slate-800/60 border-slate-700/50 hover:bg-slate-800" 
                      : "bg-slate-850/40 border-slate-800/40 hover:bg-slate-800/40 opacity-75"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div 
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow shrink-0 ${!isActive ? 'grayscale opacity-75 bg-slate-600' : ''}`}
                      style={isActive ? { backgroundColor: user.color || "#10b981" } : undefined}
                    >
                      {user.avatar ? (
                        <img src={user.avatar} alt={user.username} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        user.username[0]?.toUpperCase() || "U"
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-white truncate block">{user.username}</span>
                        {isActive ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0"></span>
                        )}
                      </div>
                      <span className="text-[9px] text-slate-400 truncate block">
                        {isActive ? (user.status || "Çevrimiçi") : `Son Görülme: ${formatLastSeen(user.lastSeen || user.updatedAt)}`}
                      </span>
                    </div>
                  </div>
                  <Navigation size={13} className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1" />
                </div>
              );
            })}

            {!myCoords && usersLocations.filter(u => u.userId !== currentUserId).length === 0 && (
              <div className="p-3 text-center text-slate-400 text-xs">
                Şu anda haritada kullanıcı bulunmuyor.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Center On Me FAB */}
      <div className="absolute bottom-5 right-5 z-[1000] flex flex-col gap-2 pointer-events-auto">
        <button
          onClick={handleCenterOnMe}
          className="w-11 h-11 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-600/40 border border-blue-400 flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer"
          title="Beni Haritada Ortala"
        >
          <Crosshair size={20} />
        </button>
      </div>

      {/* Leaflet Map DOM Canvas */}
      <div 
        ref={mapContainerRef} 
        className="w-full h-full z-0 relative touch-pan-x touch-pan-y" 
      />
    </div>
  );
}
