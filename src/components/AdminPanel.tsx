import React, { useState, useEffect, useCallback } from "react";
import { Socket } from "socket.io-client";
import { 
  ShieldAlert, Users, Cpu, Laptop, Trash2, Ban, CheckCircle2, 
  RefreshCw, Megaphone, Search, Activity, Clock, 
  Unlock, Crown, Server, AlertTriangle, Filter, Eye, UserX,
  Radio, HardDrive, Terminal, X
} from "lucide-react";
import { getApiUrl } from "../utils/api";

interface AdminOverview {
  totalUsers: number;
  onlineCount: number;
  bannedUsersCount: number;
  bannedHardwareCount: number;
  totalPosts: number;
  totalMessages: number;
  totalAnnouncements: number;
  uptimeSeconds: number;
  memoryRssMb: number;
  nodeVersion: string;
  serverTime: string;
}

interface UserItem {
  id: number;
  username: string;
  email?: string;
  avatar?: string | null;
  color?: string;
  is_admin?: number;
  is_banned?: number;
  isBanned?: number;
  banned_at?: string;
  ban_reason?: string;
  created_at?: string;
  last_active?: string;
  device_fingerprint?: string;
  last_device_id?: string;
  last_ip?: string;
  isOnline?: boolean;
}

interface BannedHardwareItem {
  id: number;
  device_fingerprint: string;
  banned_user_id?: string;
  banned_by?: string;
  reason?: string;
  banned_at?: string;
}

interface AccessLogItem {
  id: number;
  userId?: number;
  ipAddress?: string;
  action?: string;
  timestamp?: string;
}

interface AdminPanelProps {
  socket: Socket | null;
  currentUsername: string;
  onUserClick?: (userId: number) => void;
}

export default function AdminPanel({ socket, currentUsername, onUserClick }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "hardware" | "broadcast" | "logs">("overview");
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [bannedHardware, setBannedHardware] = useState<BannedHardwareItem[]>([]);
  const [logs, setLogs] = useState<AccessLogItem[]>([]);
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [userFilter, setUserFilter] = useState<"all" | "banned" | "active" | "admins">("all");
  
  // Modal states
  const [selectedUserForBan, setSelectedUserForBan] = useState<UserItem | null>(null);
  const [banType, setBanType] = useState<"account" | "hardware">("account");
  const [banReason, setBanReason] = useState<string>("Kural ihlali sebebiyle erişiminiz engellendi.");
  const [confirmClearAllBansModal, setConfirmClearAllBansModal] = useState<boolean>(false);
  
  // Broadcast modal state
  const [broadcastTitle, setBroadcastTitle] = useState<string>("📢 YÖNETİCİ DUYURUSU");
  const [broadcastMessage, setBroadcastMessage] = useState<string>("");
  const [broadcastType, setBroadcastType] = useState<"urgent" | "info" | "warning">("urgent");

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const getAuthHeaders = () => {
    const token = localStorage.getItem("lan_token") || "";
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    };
  };

  // Fetch Overview Stats
  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl("/api/admin/overview"), { credentials: "include", headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setOverview(data);
      }
    } catch (e) {
      console.error("Error fetching admin overview:", e);
    }
  }, []);

  // Fetch Users List
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const baseUrl = getApiUrl("/api/admin/users");
      const url = new URL(baseUrl, window.location.origin);
      if (searchQuery) url.searchParams.set("search", searchQuery);
      if (userFilter !== "all") url.searchParams.set("filter", userFilter);
      
      const res = await fetch(url.toString(), { credentials: "include", headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (e) {
      console.error("Error fetching admin users:", e);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, userFilter]);

  // Fetch Banned Hardware Records
  const fetchBannedHardware = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/admin/banned-hardware"), { credentials: "include", headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setBannedHardware(data.hardware || []);
      }
    } catch (e) {
      console.error("Error fetching banned hardware:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Access Logs
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/admin/access-logs"), { credentials: "include", headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.error("Error fetching access logs:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load and tab changes
  useEffect(() => {
    fetchOverview();
    if (activeTab === "users") fetchUsers();
    else if (activeTab === "hardware") fetchBannedHardware();
    else if (activeTab === "logs") fetchLogs();
  }, [activeTab, fetchOverview, fetchUsers, fetchBannedHardware, fetchLogs]);

  // Listen to socket live admin updates
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => {
      fetchOverview();
      if (activeTab === "users") fetchUsers();
      if (activeTab === "hardware") fetchBannedHardware();
    };

    socket.on("user_banned", handleUpdate);
    socket.on("user_unbanned", handleUpdate);
    socket.on("admin_bans_reset", handleUpdate);
    socket.on("online_users", handleUpdate);

    return () => {
      socket.off("user_banned", handleUpdate);
      socket.off("user_unbanned", handleUpdate);
      socket.off("admin_bans_reset", handleUpdate);
      socket.off("online_users", handleUpdate);
    };
  }, [socket, activeTab, fetchOverview, fetchUsers, fetchBannedHardware]);

  // 1. Action: Clear ALL Hardware Bans
  const handleClearAllHardwareBans = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/admin/clear-all-hardware-bans"), {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(),
        body: JSON.stringify({ unbanUsers: true })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Tüm donanım ve kullanıcı banları sıfırlandı!", "success");
        setConfirmClearAllBansModal(false);
        fetchOverview();
        fetchBannedHardware();
        fetchUsers();
      } else {
        showToast(data.error || "Hata oluştu", "error");
      }
    } catch (e: any) {
      showToast(e.message || "İstek başarısız", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Action: Unban single Hardware Fingerprint
  const handleUnbanHardware = async (device_fingerprint: string, id: number) => {
    setActionLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/admin/unban-hardware"), {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(),
        body: JSON.stringify({ device_fingerprint, id })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Donanım banı kaldırıldı", "success");
        setBannedHardware((prev) => prev.filter((item) => item.device_fingerprint !== device_fingerprint && item.id !== id));
        fetchOverview();
      } else {
        showToast(data.error || "Hata oluştu", "error");
      }
    } catch (e: any) {
      showToast(e.message || "İstek başarısız", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Action: Unban User Account
  const handleUnbanUser = async (userId: number) => {
    setActionLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/admin/unban-user"), {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(),
        body: JSON.stringify({ userId, unbanHardwareToo: true })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Kullanıcı banı kaldırıldı", "success");
        fetchUsers();
        fetchOverview();
      } else {
        showToast(data.error || "Hata oluştu", "error");
      }
    } catch (e: any) {
      showToast(e.message || "İstek başarısız", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Action: Execute Ban (Account or Hardware)
  const handleExecuteBan = async () => {
    if (!selectedUserForBan) return;
    setActionLoading(true);
    try {
      const endpoint = banType === "hardware"
        ? getApiUrl(`/api/admin/users/${selectedUserForBan.id}/ban-hardware`)
        : getApiUrl(`/api/admin/users/${selectedUserForBan.id}/ban-account`);

      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(),
        body: JSON.stringify({ 
          reason: banReason,
          hardwareFingerprint: selectedUserForBan.device_fingerprint || selectedUserForBan.last_device_id
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Kullanıcı başarıyla banlandı", "success");
        setSelectedUserForBan(null);
        fetchUsers();
        fetchOverview();
      } else {
        showToast(data.error || "Hata oluştu", "error");
      }
    } catch (e: any) {
      showToast(e.message || "İstek başarısız", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Action: Toggle Admin status
  const handleToggleAdmin = async (userId: number) => {
    setActionLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/admin/users/${userId}/toggle-admin`), {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Adminlik durumu güncellendi", "success");
        fetchUsers();
      } else {
        showToast(data.error || "Hata oluştu", "error");
      }
    } catch (e: any) {
      showToast(e.message || "İstek başarısız", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Action: Delete User Account Permanently
  const handleDeleteUser = async (userId: number, username: string) => {
    if (!window.confirm(`"${username}" adlı kullanıcının tüm verilerini ve hesabını kalıcı olarak silmek istediğinize emin misiniz?`)) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/admin/users/${userId}`), {
        method: "DELETE",
        credentials: "include",
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Kullanıcı kalıcı olarak silindi", "success");
        fetchUsers();
        fetchOverview();
      } else {
        showToast(data.error || "Hata oluştu", "error");
      }
    } catch (e: any) {
      showToast(e.message || "İstek başarısız", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // 7. Action: Send Live Broadcast Alert
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/admin/broadcast-alert"), {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title: broadcastTitle,
          message: broadcastMessage,
          type: broadcastType
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Canlı duyuru tüm çevrimiçi kullanıcılara iletildi!", "success");
        setBroadcastMessage("");
      } else {
        showToast(data.error || "Hata oluştu", "error");
      }
    } catch (e: any) {
      showToast(e.message || "İstek başarısız", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d > 0 ? `${d}g ` : ""}${h}sa ${m}dk`;
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full max-w-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Admin Top Header */}
      <div className="px-4 sm:px-6 py-3.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-rose-600 flex items-center justify-center text-white font-black shadow-lg shadow-amber-500/20 shrink-0">
            <Crown size={22} className="text-amber-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-black text-white tracking-wide">
                Emirgan Yönetici & Güvenlik Paneli
              </h1>
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md text-[10px] font-bold">
                ROOT / MASTER
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Donanım Banları, Kullanıcı Moderasyonu ve 5651 Sistem Denetim Merkezi
            </p>
          </div>
        </div>

        {/* Global Quick Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setConfirmClearAllBansModal(true)}
            className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            title="Sistemdeki tüm donanım ve cihaz yasaklamalarını sıfırlar"
          >
            <Unlock size={14} /> Tüm Donanım Banlarını Temizle
          </button>
          <button
            onClick={() => {
              fetchOverview();
              if (activeTab === "users") fetchUsers();
              if (activeTab === "hardware") fetchBannedHardware();
              if (activeTab === "logs") fetchLogs();
            }}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-all cursor-pointer"
            title="Yenile"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Admin Tab Navigation */}
      <div className="flex bg-slate-900/60 border-b border-slate-800 px-4 sm:px-6 overflow-x-auto no-scrollbar shrink-0 text-xs font-semibold gap-1 sm:gap-2 pt-1.5">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-3.5 py-2 rounded-t-xl border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === "overview"
              ? "border-amber-500 text-amber-400 bg-slate-800/80 font-bold"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <Activity size={14} /> Genel Bakış & Sistem
        </button>

        <button
          onClick={() => setActiveTab("hardware")}
          className={`px-3.5 py-2 rounded-t-xl border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === "hardware"
              ? "border-rose-500 text-rose-400 bg-slate-800/80 font-bold"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <Laptop size={14} /> Yasaklı Donanımlar ({overview?.bannedHardwareCount ?? bannedHardware.length})
        </button>

        <button
          onClick={() => setActiveTab("users")}
          className={`px-3.5 py-2 rounded-t-xl border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === "users"
              ? "border-blue-500 text-blue-400 bg-slate-800/80 font-bold"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <Users size={14} /> Kullanıcı Yönetimi
        </button>

        <button
          onClick={() => setActiveTab("broadcast")}
          className={`px-3.5 py-2 rounded-t-xl border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === "broadcast"
              ? "border-cyan-500 text-cyan-400 bg-slate-800/80 font-bold"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <Megaphone size={14} /> Acil Duyuru Yayını
        </button>

        <button
          onClick={() => setActiveTab("logs")}
          className={`px-3.5 py-2 rounded-t-xl border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === "logs"
              ? "border-emerald-500 text-emerald-400 bg-slate-800/80 font-bold"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <Terminal size={14} /> 5651 Güvenlik Logları
        </button>
      </div>

      {/* Main Tab Content Area */}
      <div className="flex-1 p-3 sm:p-6 overflow-y-auto">
        {/* ========================================================
            TAB 1: OVERVIEW & SYSTEM METRICS
            ======================================================== */}
        {activeTab === "overview" && (
          <div className="space-y-4 sm:space-y-6 max-w-6xl mx-auto">
            {/* Metric KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
                  <span>Kayıtlı Kullanıcı</span>
                  <Users size={16} className="text-blue-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white">{overview?.totalUsers ?? "—"}</div>
                <div className="text-[11px] text-emerald-400 font-medium mt-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  {overview?.onlineCount ?? 0} Çevrimiçi Kullanıcı
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
                  <span>Yasaklı Donanımlar</span>
                  <Laptop size={16} className="text-rose-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-rose-400">{overview?.bannedHardwareCount ?? "0"}</div>
                <div className="text-[11px] text-slate-400 font-medium mt-1">
                  {overview?.bannedUsersCount ?? 0} Yasaklı Hesap
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
                  <span>İçerik & Mesajlar</span>
                  <HardDrive size={16} className="text-purple-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white">{overview?.totalMessages ?? "—"}</div>
                <div className="text-[11px] text-slate-400 font-medium mt-1">
                  {overview?.totalPosts ?? 0} Gönderi • {overview?.totalAnnouncements ?? 0} Duyuru
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
                  <span>Sunucu Durumu</span>
                  <Server size={16} className="text-amber-400" />
                </div>
                <div className="text-lg sm:text-xl font-bold text-white truncate">
                  {overview ? formatUptime(overview.uptimeSeconds) : "—"}
                </div>
                <div className="text-[11px] text-slate-400 font-medium mt-1">
                  RAM: {overview?.memoryRssMb ?? 0} MB • {overview?.nodeVersion || "Node.js"}
                </div>
              </div>
            </div>

            {/* Quick Actions & Security Banner */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-850 border border-slate-800 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="text-amber-400" size={18} /> Donanım Banı Güvenlik Protokolü
                </h3>
                <p className="text-xs text-slate-400 max-w-2xl">
                  Platformumuzda IP adresleri tamamen devre dışı bırakılmış olup, tüm moderasyon cihazın anakart/WebGL/ekran bileşenlerinden türetilen <b>Hardware Fingerprint</b> ile yürütülür.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  onClick={() => setConfirmClearAllBansModal(true)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/30 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Unlock size={14} /> Tüm Banları Kaldır (Temizle)
                </button>
                <button
                  onClick={() => setActiveTab("broadcast")}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/30 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Megaphone size={14} /> Acil Duyuru Gönder
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 2: BANNED HARDWARE DEVICES (DONANIM BANLARI)
            ======================================================== */}
        {activeTab === "hardware" && (
          <div className="space-y-4 max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 p-4 rounded-2xl border border-slate-800">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <Laptop className="text-rose-400" size={18} /> Yasaklanan Cihazlar & Donanım Listesi
                </h2>
                <p className="text-xs text-slate-400">
                  Bu cihazlar platforma yeni hesap açsalar veya VPN kullansalar bile otomatik olarak engellenir.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setConfirmClearAllBansModal(true)}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition-all cursor-pointer"
                >
                  <Unlock size={14} /> Tüm Donanım Banlarını Sıfırla
                </button>
              </div>
            </div>

            {/* Hardware List Table */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow">
              {bannedHardware.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs space-y-2">
                  <CheckCircle2 size={32} className="mx-auto text-emerald-400" />
                  <p className="font-bold text-slate-200">Yasaklı Cihaz Bulunmuyor</p>
                  <p>Şu anda sistemde aktif hiçbir donanım/cihaz banı bulunmamaktadır.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/70 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="p-3.5">Cihaz Donanım Kimliği (Hardware Fingerprint)</th>
                        <th className="p-3.5">İlişkili Kullanıcı ID</th>
                        <th className="p-3.5">Ban Nedeni</th>
                        <th className="p-3.5">Ban Tarihi</th>
                        <th className="p-3.5 text-right">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {bannedHardware.map((hw) => (
                        <tr key={hw.id || hw.device_fingerprint} className="hover:bg-slate-850/60 transition-colors">
                          <td className="p-3.5">
                            <span className="px-2 py-1 bg-slate-800 text-rose-300 rounded font-semibold text-[11px] border border-slate-700">
                              {hw.device_fingerprint}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-300 font-sans">
                            {hw.banned_user_id ? (
                              <button
                                onClick={() => onUserClick?.(Number(hw.banned_user_id))}
                                className="text-blue-400 hover:underline font-bold"
                              >
                                User #{hw.banned_user_id}
                              </button>
                            ) : "—"}
                          </td>
                          <td className="p-3.5 text-slate-300 font-sans">{hw.reason || "Kural İhlali"}</td>
                          <td className="p-3.5 text-slate-400 text-[11px] font-sans">
                            {hw.banned_at ? new Date(hw.banned_at).toLocaleString("tr-TR") : "—"}
                          </td>
                          <td className="p-3.5 text-right font-sans">
                            <button
                              onClick={() => handleUnbanHardware(hw.device_fingerprint, hw.id)}
                              disabled={actionLoading}
                              className="px-3 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold transition-all cursor-pointer"
                            >
                              Banı Kaldır
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 3: USER MANAGEMENT & MODERATION
            ======================================================== */}
        {activeTab === "users" && (
          <div className="space-y-4 max-w-6xl mx-auto">
            {/* Search & Filter Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 p-3.5 rounded-2xl border border-slate-800">
              <div className="relative w-full sm:w-72">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Kullanıcı adı, ID veya e-posta ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                {(["all", "active", "banned", "admins"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setUserFilter(f)}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                      userFilter === f ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {f === "all" && "Tümü"}
                    {f === "active" && "Aktif"}
                    {f === "banned" && "Yasaklı"}
                    {f === "admins" && "Yöneticiler"}
                  </button>
                ))}
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/70 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="p-3.5">Kullanıcı</th>
                      <th className="p-3.5">ID / Rol</th>
                      <th className="p-3.5">Durum</th>
                      <th className="p-3.5">Donanım Kimliği</th>
                      <th className="p-3.5 text-right">Moderasyon İşlemleri</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {users.map((u) => {
                      const isBanned = Boolean(u.is_banned || u.isBanned);
                      const isEmirgan = u.username.toLowerCase() === "emirgan";
                      return (
                        <tr key={u.id} className="hover:bg-slate-850/60 transition-colors">
                          {/* User Avatar + Username */}
                          <td className="p-3.5">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs uppercase overflow-hidden shrink-0 border border-slate-700"
                                style={{ backgroundColor: u.color || "#3b82f6" }}
                              >
                                {u.avatar ? (
                                  <img src={u.avatar} alt={u.username} className="w-full h-full object-cover" />
                                ) : (
                                  u.username[0]
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span
                                    onClick={() => onUserClick?.(u.id)}
                                    className="font-bold text-white hover:text-blue-400 hover:underline cursor-pointer"
                                  >
                                    {u.username}
                                  </span>
                                  {u.isOnline && (
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" title="Çevrimiçi" />
                                  )}
                                  {isEmirgan && (
                                    <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded text-[9px] font-bold">
                                      KURUCU
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400">{u.email || "E-posta yok"}</div>
                              </div>
                            </div>
                          </td>

                          {/* ID / Role */}
                          <td className="p-3.5">
                            <span className="font-mono text-slate-300 font-bold">#{u.id}</span>
                            <div className="text-[10px] text-slate-400 font-sans">
                              {u.is_admin ? "Yönetici (Admin)" : "Standart Üye"}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="p-3.5">
                            {isBanned ? (
                              <div>
                                <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-md text-[10px] font-bold">
                                  YASAKLI (BANNED)
                                </span>
                                {u.ban_reason && (
                                  <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[180px]">
                                    {u.ban_reason}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-md text-[10px] font-bold">
                                AKTİF
                              </span>
                            )}
                          </td>

                          {/* Hardware Fingerprint */}
                          <td className="p-3.5 font-mono text-[11px] text-slate-400">
                            {u.device_fingerprint || u.last_device_id ? (
                              <span className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-slate-300">
                                {u.device_fingerprint || u.last_device_id}
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>

                          {/* Action Buttons */}
                          <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                            {!isEmirgan && (
                              <>
                                {isBanned ? (
                                  <button
                                    onClick={() => handleUnbanUser(u.id)}
                                    disabled={actionLoading}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                                  >
                                    Banı Kaldır
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => {
                                        setSelectedUserForBan(u);
                                        setBanType("account");
                                      }}
                                      className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                                    >
                                      Hesabı Banla
                                    </button>
                                    <button
                                      onClick={() => {
                                        setSelectedUserForBan(u);
                                        setBanType("hardware");
                                      }}
                                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[11px] font-bold shadow transition-all cursor-pointer"
                                    >
                                      Donanım Banı
                                    </button>
                                  </>
                                )}

                                <button
                                  onClick={() => handleToggleAdmin(u.id)}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                    u.is_admin
                                      ? "bg-amber-600/20 text-amber-300 border border-amber-500/30"
                                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                                  }`}
                                  title={u.is_admin ? "Adminliği Kaldır" : "Admin Yap"}
                                >
                                  {u.is_admin ? "Adminliği Al" : "Admin Yap"}
                                </button>

                                <button
                                  onClick={() => handleDeleteUser(u.id, u.username)}
                                  className="p-1 bg-red-950/60 hover:bg-red-900 text-red-400 rounded-lg border border-red-800/40 transition-all cursor-pointer"
                                  title="Kullanıcıyı ve tüm verilerini kalıcı olarak sil"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 4: BROADCAST EMERGENCY NOTIFICATIONS
            ======================================================== */}
        {activeTab === "broadcast" && (
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg space-y-4">
              <div className="flex items-center gap-2 text-cyan-400">
                <Megaphone size={20} />
                <h2 className="text-base font-bold text-white">Tüm Kullanıcılara Canlı Acil Duyuru Gönder</h2>
              </div>
              <p className="text-xs text-slate-400">
                Bu duyuru o anda sisteme bağlı olan tüm kullanıcıların ekranına anlık popup / flaş bildirim olarak yansır.
              </p>

              <form onSubmit={handleSendBroadcast} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Duyuru Başlığı</label>
                  <input
                    type="text"
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                    placeholder="Örn: 📢 Sistem Bakım Duyurusu"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Duyuru Türü</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setBroadcastType("urgent")}
                      className={`py-2 rounded-xl text-xs font-bold transition-all ${
                        broadcastType === "urgent"
                          ? "bg-rose-600 text-white shadow-md shadow-rose-600/30 ring-2 ring-rose-400"
                          : "bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      🚨 Kritik / Acil
                    </button>
                    <button
                      type="button"
                      onClick={() => setBroadcastType("info")}
                      className={`py-2 rounded-xl text-xs font-bold transition-all ${
                        broadcastType === "info"
                          ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-2 ring-blue-400"
                          : "bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      ℹ️ Bilgilendirme
                    </button>
                    <button
                      type="button"
                      onClick={() => setBroadcastType("warning")}
                      className={`py-2 rounded-xl text-xs font-bold transition-all ${
                        broadcastType === "warning"
                          ? "bg-amber-600 text-white shadow-md shadow-amber-600/30 ring-2 ring-amber-400"
                          : "bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      ⚠️ Uyarı
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Duyuru Mesajı</label>
                  <textarea
                    rows={4}
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 resize-none"
                    placeholder="Duyuru içeriğinizi buraya yazın..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={actionLoading || !broadcastMessage.trim()}
                  className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-cyan-600/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Radio size={16} /> Canlı Duyuruyu Herkese Yayınla
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 5: 5651 ACCESS & AUDIT LOGS
            ======================================================== */}
        {activeTab === "logs" && (
          <div className="space-y-4 max-w-6xl mx-auto">
            <div className="flex items-center justify-between bg-slate-900 p-4 rounded-2xl border border-slate-800">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <Terminal className="text-emerald-400" size={18} /> 5651 Sayılı Kanun Erişim ve Denetim Kayıtları
                </h2>
                <p className="text-xs text-slate-400">
                  Kullanıcı oturumları, bağlantı hareketleri ve IP trafik kayıtları.
                </p>
              </div>
              <button
                onClick={fetchLogs}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw size={13} /> Logları Yenile
              </button>
            </div>

            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow">
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/70 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider sticky top-0">
                    <tr>
                      <th className="p-3.5">ID</th>
                      <th className="p-3.5">Kullanıcı ID</th>
                      <th className="p-3.5">İşlem / Eylem</th>
                      <th className="p-3.5">IP Adresi</th>
                      <th className="p-3.5">Zaman Damgası (UTC)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-850/60">
                        <td className="p-3 text-slate-500">#{log.id}</td>
                        <td className="p-3 text-blue-400 font-bold">
                          {log.userId ? `User #${log.userId}` : "Misafir"}
                        </td>
                        <td className="p-3 text-slate-200 font-sans">{log.action}</td>
                        <td className="p-3 text-emerald-400">{log.ipAddress}</td>
                        <td className="p-3 text-slate-400 font-sans">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString("tr-TR") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================
          MODAL: BAN USER / HARDWARE CONFIRMATION
          ======================================================== */}
      {selectedUserForBan && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                <Ban className="text-rose-500" size={18} />
                {banType === "hardware" ? "Fiziksel Donanım Banı Uygula" : "Kullanıcı Hesabını Banla"}
              </h3>
              <button
                onClick={() => setSelectedUserForBan(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1 text-xs">
              <div><span className="text-slate-400">Hedef Kullanıcı:</span> <b className="text-white">{selectedUserForBan.username}</b> (ID #{selectedUserForBan.id})</div>
              {banType === "hardware" && (
                <div>
                  <span className="text-slate-400">Donanım Kimliği:</span>{" "}
                  <code className="text-rose-400 font-mono font-bold">
                    {selectedUserForBan.device_fingerprint || selectedUserForBan.last_device_id || "Otomatik Saptanacak"}
                  </code>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Ban Gerekçesi</label>
              <textarea
                rows={3}
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500 resize-none"
                placeholder="Ban gerekçesini girin..."
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedUserForBan(null)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                İptal
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleExecuteBan}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                {actionLoading ? "İşleniyor..." : "Yasaklamayı Onayla"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: CONFIRM CLEAR ALL BANS
          ======================================================== */}
      {confirmClearAllBansModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-slate-900 border border-rose-900/60 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle size={24} />
              <h3 className="font-bold text-white text-base">Tüm Donanım Banları Sıfırlansın mı?</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Bu işlem veritabanındaki <b>bütün donanım ve cihaz ban kayıtlarını kalıcı olarak temizleyecek</b> ve daha önce yasaklanan tüm cihazların platforma yeniden erişmesine izin verecektir.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmClearAllBansModal(false)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleClearAllHardwareBans}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                {actionLoading ? "Sıfırlanıyor..." : "Evet, Tümünü Temizle"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-3 rounded-2xl text-xs font-bold shadow-2xl z-50 flex items-center gap-2 animate-in slide-in-from-bottom-5 ${
            toastMessage.type === "success"
              ? "bg-emerald-600 text-white shadow-emerald-500/20"
              : "bg-rose-600 text-white shadow-rose-500/20"
          }`}
        >
          {toastMessage.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{toastMessage.text}</span>
        </div>
      )}
    </div>
  );
}
