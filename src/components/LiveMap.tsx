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
  CheckCircle2, 
  Info,
  Search,
  Move,
  Check,
  X,
  RotateCcw,
  Loader2,
  MapPinned
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
  return timeStr;
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
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isSharing, setIsSharing] = useState<boolean>(() => localStorage.getItem("isLocationActive") === "true");
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [myCoords, setMyCoords] = useState<{ lat: number; lng: number } | null>(() => {
    const savedManual = localStorage.getItem("kapsapp_manual_location");
    const isManualSet = localStorage.getItem("kapsapp_is_manual_location") === "true";
    if (isManualSet && savedManual) {
      try {
        const parsed = JSON.parse(savedManual);
        if (typeof parsed?.lat === "number" && typeof parsed?.lng === "number") {
          return parsed;
        }
      } catch (e) {}
    }
    return null;
  });

  const [isManualLocationSet, setIsManualLocationSet] = useState<boolean>(() => {
    return localStorage.getItem("kapsapp_is_manual_location") === "true";
  });

  const [isEditingLocation, setIsEditingLocation] = useState<boolean>(false);
  const [dragTempCoords, setDragTempCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [usersLocations, setUsersLocations] = useState<UserLiveLocation[]>([]);
  const [, setSelectedUser] = useState<UserLiveLocation | null>(null);
  const [showUsersPanel, setShowUsersPanel] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showSearchResults, setShowSearchResults] = useState<boolean>(false);

  // Helper to create custom HTML Marker Icon
  const createCustomMarkerIcon = useCallback((user: UserLiveLocation, isMe: boolean, isEditing: boolean = false) => {
    const isCurrentUser = isMe || user.userId === currentUserId;
    const isActive = user.isLocationActive !== false;
    
    let ringColor = isActive 
      ? (isCurrentUser ? "#3b82f6" : (user.color || "#10b981"))
      : "#64748b";
    
    let glowColor = isActive
      ? (isCurrentUser ? "rgba(59, 130, 246, 0.45)" : "rgba(16, 185, 129, 0.45)")
      : "transparent";

    if (isCurrentUser && isEditing) {
      ringColor = "#f59e0b";
      glowColor = "rgba(245, 158, 11, 0.65)";
    }

    const initial = (user.username?.[0] || "U").toUpperCase();

    const avatarHtml = user.avatar
      ? `<img src="${user.avatar}" alt="${user.username}" class="w-full h-full object-cover rounded-full pointer-events-none" />`
      : `<div class="w-full h-full flex items-center justify-center rounded-full text-white font-bold text-xs pointer-events-none" style="background-color: ${isActive ? (user.color || '#6366f1') : '#475569'};">${initial}</div>`;

    const html = `
      <div class="relative flex items-center justify-center group cursor-grab active:cursor-grabbing" 
           style="width: 52px; height: 52px; ${!isActive ? 'opacity: 0.5; filter: grayscale(100%);' : 'opacity: 1; filter: none;'} transition: all 0.25s ease;">
        ${isActive ? `
          <!-- Glowing Pulse Radar Effect -->
          <div class="absolute inset-0 rounded-full ${isEditing ? 'animate-ping' : 'animate-ping'} opacity-60 pointer-events-none" style="background-color: ${glowColor};"></div>
          <div class="absolute inset-1 rounded-full animate-pulse opacity-40 pointer-events-none" style="background-color: ${ringColor};"></div>
        ` : ''}
        
        <!-- Main Avatar Circle -->
        <div class="relative z-10 w-11 h-11 rounded-full p-0.5 shadow-xl border-2 transition-all duration-300 transform ${isEditing ? 'scale-125 ring-4 ring-amber-400/50' : 'hover:scale-110'}" 
             style="background-color: #0f172a; border-color: ${ringColor}; ${isActive ? `box-shadow: 0 0 16px ${glowColor};` : 'box-shadow: 0 4px 6px -1px rgba(0,0,0,0.5);'}">
          <div class="w-full h-full rounded-full overflow-hidden bg-slate-800">
            ${avatarHtml}
          </div>
          ${isCurrentUser ? `
            <div class="absolute -bottom-1 -right-1 w-4 h-4 ${isEditing ? 'bg-amber-500' : (isActive ? 'bg-blue-500' : 'bg-slate-500')} rounded-full border-2 border-slate-900 flex items-center justify-center text-[8px] font-black text-white">
              ${isEditing ? '✦' : '★'}
            </div>
          ` : (
            !isActive ? '<div class="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-slate-600 rounded-full border-2 border-slate-900 flex items-center justify-center text-[8px] text-slate-300">✕</div>' : ''
          )}
        </div>

        <!-- Floating Username / Drag Tag -->
        <div class="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-bold shadow-lg backdrop-blur-md pointer-events-none transition-all ${
          isEditing 
            ? 'bg-amber-500 text-slate-950 font-black border border-amber-300 animate-bounce' 
            : (!isActive ? 'bg-slate-800/90 text-slate-400 border border-slate-700/60' : 'bg-slate-900/90 text-white border border-white/15')
        }">
          ${isEditing ? '📌 Sürükleyin' : (isCurrentUser ? 'Siz' : user.username)}
        </div>
      </div>
    `;

    return L.divIcon({
      className: "custom-leaflet-pin",
      html,
      iconSize: [52, 52],
      iconAnchor: [26, 26],
      popupAnchor: [0, -28]
    });
  }, [currentUserId]);

  // Create Popup Content
  const createPopupContent = useCallback((user: UserLiveLocation, isMe: boolean) => {
    const isCurrentUser = isMe || user.userId === currentUserId;
    const isActive = user.isLocationActive !== false;
    const initial = (user.username?.[0] || "U").toUpperCase();
    
    const avatarHtml = user.avatar
      ? `<img src="${user.avatar}" class="w-11 h-11 rounded-full object-cover border-2 ${isActive ? 'border-slate-700' : 'border-slate-600 grayscale opacity-75'}" />`
      : `<div class="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base ${!isActive ? 'grayscale opacity-75 bg-slate-600' : ''}" style="${isActive ? `background-color: ${user.color || '#6366f1'}` : ''}">${initial}</div>`;

    const statusText = isActive 
      ? (user.status || "Aktif Çevrimiçi")
      : `Son Görülme: ${formatLastSeen(user.lastSeen || user.updatedAt)}`;

    const statusColor = isActive
      ? (user.status?.includes("Okey") ? "#f59e0b" : user.status?.includes("UNO") ? "#ef4444" : user.status?.includes("Çiz") ? "#8b5cf6" : "#10b981")
      : "#94a3b8";

    const container = document.createElement("div");
    container.className = "p-3.5 bg-slate-900 text-slate-100 rounded-2xl border border-slate-700 shadow-2xl min-w-[220px] select-none";
    container.innerHTML = `
      <div class="flex items-center gap-3 mb-2.5">
        ${avatarHtml}
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5">
            <h4 class="font-bold text-sm text-white truncate">${user.username}</h4>
            ${isCurrentUser ? '<span class="text-[10px] bg-blue-500/20 text-blue-400 font-semibold px-1.5 py-0.2 rounded-full border border-blue-500/30">Siz</span>' : ''}
          </div>
          <div class="flex items-center gap-1.5 text-xs text-slate-300 mt-0.5">
            <span class="w-2 h-2 rounded-full shrink-0" style="background-color: ${statusColor}"></span>
            <span class="truncate ${!isActive ? 'text-slate-400 font-medium' : 'text-slate-200'}">${statusText}</span>
          </div>
        </div>
      </div>
      
      <div class="text-[10px] text-slate-400 mb-3 flex items-center justify-between border-t border-slate-800 pt-2 font-mono">
        <span class="text-slate-500">Koordinat:</span>
        <span class="text-slate-300">${user.lat.toFixed(4)}, ${user.lng.toFixed(4)}</span>
      </div>

      <div class="flex gap-2">
        <button class="btn-popup-profile flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
          <svg class="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          <span>Profil</span>
        </button>
        ${!isCurrentUser ? `
          <button class="btn-popup-chat flex-1 py-1.5 px-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/30 cursor-pointer">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            <span>Mesaj</span>
          </button>
        ` : `
          <button class="btn-popup-edit flex-1 py-1.5 px-2 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-amber-600/30 cursor-pointer">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            <span>Pinimi Taşı</span>
          </button>
        `}
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

    const btnEdit = container.querySelector(".btn-popup-edit");
    if (btnEdit) {
      btnEdit.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        setDragTempCoords({ lat: user.lat, lng: user.lng });
        setIsEditingLocation(true);
        if (markersRef.current.get(user.userId)) {
          markersRef.current.get(user.userId)?.closePopup();
        }
      });
    }

    return container;
  }, [currentUserId, onUserClick, onOpenChat]);

  // Stop location sharing
  const stopLocationSharing = useCallback(() => {
    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
    setIsSharing(false);
    setIsLocating(false);
    setIsEditingLocation(false);
    localStorage.setItem("isLocationActive", "false");

    if (socket) {
      socket.emit("stop_sharing_location");
    }
  }, [socket]);

  // High-accuracy Geolocation fetch
  const fetchAndSendPosition = useCallback((shouldFlyTo: boolean = false, forceGps: boolean = false) => {
    // If manual location is set and we're not forcing GPS, use manual location
    if (!forceGps && isManualLocationSet && myCoords) {
      setIsSharing(true);
      setIsLocating(false);
      setGeoError(null);
      if (shouldFlyTo && mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([myCoords.lat, myCoords.lng], 14, { animate: true, duration: 1.2 });
      }
      if (socket) {
        socket.emit("update_user_location", { lat: myCoords.lat, lng: myCoords.lng, isManual: true });
      }
      return;
    }

    if (!navigator.geolocation) {
      setGeoError("Tarayıcınız konum servisini (Geolocation API) desteklemiyor.");
      setIsLocating(false);
      return;
    }

    const geoOptions: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setMyCoords({ lat: latitude, lng: longitude });
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
        }
      },
      (err) => {
        setIsLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError("Konum izni verilmedi; 'Konumu Düzelt' butonu ile pininizi haritada manuel yerleştirebilirsiniz.");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGeoError("Konum bilgisi alınamadı. 'Konumu Düzelt' ile manuel konum belirleyebilirsiniz.");
        } else if (err.code === err.TIMEOUT) {
          setGeoError("Konum isteği zaman aşımına uğradı. Manuel olarak pininizi taşıyabilirsiniz.");
        } else {
          setGeoError("Konum alınırken bir hata oluştu: " + err.message);
        }
      },
      geoOptions
    );
  }, [socket, isManualLocationSet, myCoords]);

  // Start tracking
  const startLocationSharing = useCallback(() => {
    setIsLocating(true);
    setGeoError(null);
    localStorage.setItem("isLocationActive", "true");
    setIsSharing(true);

    fetchAndSendPosition(true);

    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
    }

    intervalIdRef.current = setInterval(() => {
      fetchAndSendPosition(false);
    }, 60000);
  }, [fetchAndSendPosition]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const defaultCenter: [number, number] = myCoords ? [myCoords.lat, myCoords.lng] : [39.9334, 32.8597];
    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: myCoords ? 14 : 6,
      zoomControl: false
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);

    mapInstanceRef.current = map;

    // Restore location sharing state from localStorage
    const savedActive = localStorage.getItem("isLocationActive");
    if (savedActive === "true" || savedActive === null) {
      startLocationSharing();
    }

    return () => {
      if (intervalIdRef.current !== null) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [startLocationSharing]);

  // Handle map click during edit mode to reposition pin
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (isEditingLocation) {
        const { lat, lng } = e.latlng;
        setDragTempCoords({ lat, lng });
        const myMarker = markersRef.current.get(currentUserId);
        if (myMarker) {
          myMarker.setLatLng([lat, lng]);
        }
      }
    };

    map.on("click", handleMapClick);
    return () => {
      map.off("click", handleMapClick);
    };
  }, [isEditingLocation, currentUserId]);

  // Socket.io Real-time Location synchronization
  useEffect(() => {
    if (!socket) return;

    const handleUpdateUserLocations = (locations: UserLiveLocation[]) => {
      if (Array.isArray(locations)) {
        setUsersLocations(locations);
      }
    };

    socket.on("update_user_locations", handleUpdateUserLocations);
    socket.on("all_user_locations", handleUpdateUserLocations);

    socket.emit("request_all_locations");

    return () => {
      socket.off("update_user_locations", handleUpdateUserLocations);
      socket.off("all_user_locations", handleUpdateUserLocations);
    };
  }, [socket]);

  // Sync Markers on Map whenever usersLocations, myCoords or isEditingLocation changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const activeUserIds = new Set<number>();
    const combinedList: UserLiveLocation[] = [...usersLocations];

    const currentCoords = (isEditingLocation && dragTempCoords) ? dragTempCoords : myCoords;

    if (currentCoords) {
      const existingMyIndex = combinedList.findIndex(u => u.userId === currentUserId);
      const existingServerState = existingMyIndex >= 0 ? combinedList[existingMyIndex] : null;
      const myObj: UserLiveLocation = {
        userId: currentUserId,
        username,
        avatar,
        color: color || "#3b82f6",
        lat: currentCoords.lat,
        lng: currentCoords.lng,
        status: isSharing 
          ? (isEditingLocation ? "Pin Düzenleniyor (Siz)" : "Haritada Aktif (Siz)") 
          : "Konum Kapalı (Siz)",
        isLocationActive: isSharing,
        lastSeen: isSharing ? Date.now() : (existingServerState?.lastSeen || Date.now())
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
      const icon = createCustomMarkerIcon(user, isMe, isMe && isEditingLocation);
      const popupContent = createPopupContent(user, isMe);

      if (existingMarker) {
        existingMarker.setLatLng([user.lat, user.lng]);
        existingMarker.setIcon(icon);
        existingMarker.setPopupContent(popupContent);

        if (isMe) {
          if (isEditingLocation) {
            existingMarker.dragging?.enable();
          } else {
            existingMarker.dragging?.disable();
          }
        }
      } else {
        const marker = L.marker([user.lat, user.lng], { 
          icon,
          draggable: isMe && isEditingLocation
        })
          .addTo(map)
          .bindPopup(popupContent, {
            className: "custom-leaflet-popup",
            closeButton: false,
            offset: [0, -10]
          });

        if (isMe) {
          marker.on("dragend", (e: any) => {
            const newPos = e.target.getLatLng();
            setDragTempCoords({ lat: newPos.lat, lng: newPos.lng });
          });
        }

        marker.on("click", () => {
          setSelectedUser(user);
        });

        markersRef.current.set(user.userId, marker);
      }
    });

    // Remove markers for removed users
    markersRef.current.forEach((marker, uid) => {
      if (!activeUserIds.has(uid)) {
        map.removeLayer(marker);
        markersRef.current.delete(uid);
      }
    });
  }, [usersLocations, myCoords, dragTempCoords, isSharing, isEditingLocation, currentUserId, username, avatar, color, createCustomMarkerIcon, createPopupContent]);

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

  // Start Manual Pin Edit Mode
  const handleStartManualEdit = () => {
    const startPoint = myCoords || { lat: 41.0082, lng: 28.9784 }; // Istanbul fallback if no coords
    setDragTempCoords(startPoint);
    if (!myCoords) {
      setMyCoords(startPoint);
    }
    setIsEditingLocation(true);
    setGeoError(null);

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([startPoint.lat, startPoint.lng], 15, {
        animate: true,
        duration: 1
      });
    }
  };

  // Confirm Manual Location
  const handleConfirmManualLocation = () => {
    const finalCoords = dragTempCoords || myCoords;
    if (!finalCoords) return;

    setMyCoords(finalCoords);
    setIsManualLocationSet(true);
    setIsEditingLocation(false);
    setIsSharing(true);
    localStorage.setItem("isLocationActive", "true");
    localStorage.setItem("kapsapp_is_manual_location", "true");
    localStorage.setItem("kapsapp_manual_location", JSON.stringify(finalCoords));

    if (socket) {
      socket.emit("update_user_location", { 
        lat: finalCoords.lat, 
        lng: finalCoords.lng, 
        isManual: true 
      });
    }

    setSuccessToast("📌 Pin konumunuz başarıyla kaydedildi ve sabitlendi.");
    setTimeout(() => setSuccessToast(null), 4000);
  };

  // Cancel Manual Edit Mode
  const handleCancelManualEdit = () => {
    setIsEditingLocation(false);
    setDragTempCoords(null);
  };

  // Reset to Automatic GPS
  const handleResetToAutoGps = () => {
    localStorage.removeItem("kapsapp_is_manual_location");
    localStorage.removeItem("kapsapp_manual_location");
    setIsManualLocationSet(false);
    setIsEditingLocation(false);
    setDragTempCoords(null);
    fetchAndSendPosition(true, true);
    setSuccessToast("🛰️ Otomatik GPS konumlandırmasına geri dönüldü.");
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // Search Location with OSM Nominatim
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!val.trim() || val.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&countrycodes=tr&limit=5&addressdetails=1`
        );
        const data = await res.json();
        setSearchResults(Array.isArray(data) ? data : []);
        setShowSearchResults(true);
      } catch (e) {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);
  };

  const handleSelectSearchResult = (item: any) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    if (isNaN(lat) || isNaN(lng)) return;

    setShowSearchResults(false);
    setSearchQuery(item.display_name.split(",")[0]);

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], 15, { animate: true, duration: 1.2 });
    }

    setDragTempCoords({ lat, lng });
    if (!isEditingLocation) {
      setIsEditingLocation(true);
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
    <div className="relative w-full h-full flex flex-col bg-slate-950 overflow-hidden select-none">
      {/* Top Floating Header & Controls */}
      <div className="absolute top-3 inset-x-3 z-[1000] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 pointer-events-none">
        
        {/* Left: Brand Badge & Stats */}
        <div className="flex items-center gap-2.5 bg-slate-900/90 border border-slate-700/80 backdrop-blur-xl px-3.5 py-2 rounded-2xl shadow-xl pointer-events-auto self-start">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
            <MapPin size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              Canlı Harita
              <span className="flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-400 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Anlık
              </span>
              {isManualLocationSet && (
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-semibold px-2 py-0.5 rounded-full border border-amber-500/30">
                  Sabit Pin
                </span>
              )}
            </h2>
            <p className="text-[11px] text-slate-400">
              {activeCount} Aktif Paylaşım · {totalCount} Toplam Pin
            </p>
          </div>
        </div>

        {/* Center: Search Box (Nominatim / OSM District Search) */}
        <div className="relative pointer-events-auto flex-1 max-w-sm self-center md:self-auto w-full md:w-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 border border-slate-700/80 rounded-2xl shadow-xl backdrop-blur-xl focus-within:border-blue-500 transition-colors">
            {isSearching ? (
              <Loader2 size={16} className="text-blue-400 animate-spin shrink-0" />
            ) : (
              <Search size={16} className="text-slate-400 shrink-0" />
            )}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => { if (searchResults.length > 0) setShowSearchResults(true); }}
              placeholder="İlçe, semt veya şehir ara... (Örn: Kadıköy)"
              className="bg-transparent border-none text-xs text-white placeholder-slate-400 focus:outline-none w-full"
            />
            {searchQuery && (
              <button 
                onClick={() => { setSearchQuery(""); setSearchResults([]); setShowSearchResults(false); }}
                className="text-slate-400 hover:text-white p-0.5"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Search Dropdown Results */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900/95 border border-slate-700/90 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden z-[1050] max-h-56 overflow-y-auto no-scrollbar animate-in fade-in-50">
              {searchResults.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectSearchResult(item)}
                  className="px-3.5 py-2 hover:bg-blue-600/30 border-b border-slate-800/80 last:border-b-0 cursor-pointer text-left transition-colors flex items-start gap-2"
                >
                  <MapPinned size={14} className="text-blue-400 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate">{item.display_name.split(",")[0]}</p>
                    <p className="text-[10px] text-slate-400 truncate">{item.display_name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Actions (Move Pin, Reset GPS, Users Drawer, Toggle Location) */}
        <div className="flex items-center gap-2 pointer-events-auto flex-wrap self-end md:self-auto">
          {/* Manual Pin Correction Button */}
          {!isEditingLocation ? (
            <button
              onClick={handleStartManualEdit}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white text-xs font-semibold shadow-xl shadow-amber-600/20 border border-amber-500 transition-all hover:scale-105 active:scale-95 cursor-pointer"
              title="PC/Masaüstü için konumunuzu haritada tam yerine taşıyın"
            >
              <Move size={14} />
              <span>Konumu Düzelt</span>
            </button>
          ) : null}

          {/* Revert to Auto GPS (Visible if manual pin set) */}
          {isManualLocationSet && !isEditingLocation && (
            <button
              onClick={handleResetToAutoGps}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-2xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 shadow-xl transition-all"
              title="Cihazın otomatik GPS konumuna geri dön"
            >
              <RotateCcw size={14} />
              <span className="hidden sm:inline">GPS'e Dön</span>
            </button>
          )}

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
              {totalCount}
            </span>
          </button>

          {/* Privacy & Location Sharing Toggle Button */}
          {isSharing ? (
            <button
              onClick={stopLocationSharing}
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

      {/* Manual Pin Editing Sticky Confirmation Bar */}
      {isEditingLocation && (
        <div className="absolute top-24 md:top-20 inset-x-3 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 z-[1000] p-3 bg-gradient-to-r from-amber-950/95 to-slate-900/95 border-2 border-amber-500/90 text-amber-100 rounded-3xl backdrop-blur-2xl shadow-2xl flex flex-wrap items-center justify-between gap-3 animate-in slide-in-from-top-3 max-w-xl">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
              <Move size={16} className="animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Pin Düzenleme Modu</p>
              <p className="text-[11px] text-amber-200/90">
                Pininizi sürükleyin veya haritada istediğiniz bir noktaya tıklayın.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleCancelManualEdit}
              className="flex-1 sm:flex-initial px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
            >
              İptal
            </button>
            <button
              onClick={handleConfirmManualLocation}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-amber-500/30 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Check size={14} />
              <span>Konumu Onayla</span>
            </button>
          </div>
        </div>
      )}

      {/* Success Notification Banner */}
      {successToast && (
        <div className="absolute top-24 inset-x-3 z-[1000] max-w-md mx-auto p-3 bg-emerald-950/90 border border-emerald-500/80 text-emerald-200 rounded-2xl backdrop-blur-xl shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-top-3">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <p className="text-xs font-medium">{successToast}</p>
        </div>
      )}

      {/* Permission Denied / Error Notification Banner */}
      {geoError && !isEditingLocation && (
        <div className="absolute top-24 inset-x-3 z-[1000] max-w-xl mx-auto p-3 bg-amber-950/90 border border-amber-600/80 text-amber-200 rounded-2xl backdrop-blur-xl shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-top-3">
          <div className="flex items-center gap-2.5 text-xs">
            <ShieldAlert size={18} className="text-amber-400 shrink-0" />
            <p className="leading-snug">{geoError}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleStartManualEdit}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold rounded-xl transition-colors shadow"
            >
              Pini Taşı
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
              Haritadaki Kullanıcılar ({totalCount})
            </h3>
            <button 
              onClick={() => setShowUsersPanel(false)}
              className="text-slate-400 hover:text-white text-xs cursor-pointer p-1"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 py-1">
            {/* Myself */}
            {myCoords && (
              <div 
                onClick={handleCenterOnMe}
                className={`p-2.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between group ${
                  isSharing 
                    ? "bg-blue-900/30 border-blue-700/50 hover:bg-blue-900/50" 
                    : "bg-slate-800/40 border-slate-700/40 hover:bg-slate-800/60 opacity-80"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow ${isSharing ? 'bg-blue-600' : 'bg-slate-600 grayscale'}`}>
                    {avatar ? (
                      <img src={avatar} alt={username} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      username[0]?.toUpperCase() || "S"
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-white truncate">{username}</span>
                      <span className={`text-[9px] px-1 py-0.2 rounded font-semibold ${isSharing ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-700 text-slate-400'}`}>Siz</span>
                      {isManualLocationSet && (
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 font-semibold px-1 py-0.2 rounded">Sabit</span>
                      )}
                    </div>
                    <span className={`text-[10px] block ${isSharing ? 'text-blue-300' : 'text-slate-400'}`}>
                      {isSharing ? "Canlı Paylaşılıyor" : "Konum Kapalı (Pin Haritada)"}
                    </span>
                  </div>
                </div>
                <Crosshair size={14} className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}

            {/* Other Users */}
            {usersLocations.filter(u => u.userId !== currentUserId).map((user) => {
              const isActive = user.isLocationActive !== false;
              return (
                <div
                  key={user.userId}
                  onClick={() => handleFocusUser(user)}
                  className={`p-2.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between group ${
                    isActive 
                      ? "bg-slate-800/60 border-slate-700/50 hover:bg-slate-800" 
                      : "bg-slate-850/40 border-slate-800/40 hover:bg-slate-800/40 opacity-75"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div 
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow shrink-0 ${!isActive ? 'grayscale opacity-75 bg-slate-600' : ''}`}
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
                      <span className="text-[10px] text-slate-400 truncate block">
                        {isActive ? (user.status || "Çevrimiçi") : `Son Görülme: ${formatLastSeen(user.lastSeen || user.updatedAt)}`}
                      </span>
                    </div>
                  </div>
                  <Navigation size={14} className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1" />
                </div>
              );
            })}

            {!myCoords && usersLocations.filter(u => u.userId !== currentUserId).length === 0 && (
              <div className="p-4 text-center text-slate-400 text-xs">
                Şu anda haritada kayıtlı konum bulunmuyor.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Center On Me FAB */}
      <div className="absolute bottom-6 right-6 z-[1000] flex flex-col gap-2 pointer-events-auto">
        <button
          onClick={handleCenterOnMe}
          className="w-12 h-12 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white shadow-2xl shadow-blue-600/50 border border-blue-400 flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer"
          title="Beni Haritada Ortala"
        >
          <Crosshair size={22} />
        </button>
      </div>

      {/* Leaflet Map DOM Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-0 relative" />

      {/* Bottom Floating Info Pill */}
      <div className="absolute bottom-4 left-4 z-[1000] pointer-events-none hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 text-[11px] backdrop-blur-md">
        <Info size={13} className="text-blue-400" />
        <span>PC ve mobil cihazlar için yüksek doğruluklu konum ve manuel pin sabitleme aktiftir.</span>
      </div>
    </div>
  );
}
