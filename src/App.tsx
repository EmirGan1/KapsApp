import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { MessageSquare, LayoutGrid, Users, UserCircle2, Globe, Bell, Folder, Moon, Sun, Gamepad2, Radio, MapPin, Megaphone } from "lucide-react";
import Auth from "./components/Auth";
import Feed from "./components/Feed";
import Chats from "./components/Chats";
import Friends from "./components/Friends";
import Profile from "./components/Profile";
import GlobalChat from "./components/GlobalChat";
import Notifications from "./components/Notifications";
import Games from "./components/Games";
import VoiceChat from "./components/VoiceChat";
import LiveMap from "./components/LiveMap";
import Announcements, { AnnouncementItem } from "./components/Announcements";
import AnnouncementModal from "./components/AnnouncementModal";
import ToastContainer, { ToastItem } from "./components/ToastContainer";
import { getSocketUrl } from "./utils/api";

const SUBJECTS = ["Turkish", "Mathematics", "Physics", "Digital Society", "English", "Chemistry", "Biology", "TITC"];

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("lan_token"));
  const [username, setUsername] = useState<string>(localStorage.getItem("lan_username") || "");
  const [avatar, setAvatar] = useState<string | null>(() => {
    const stored = localStorage.getItem("lan_avatar");
    return stored === "null" ? null : stored;
  });
  const [color, setColor] = useState<string | undefined>(localStorage.getItem("lan_color") || undefined);
  
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<number[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number>(Number(localStorage.getItem("lan_user_id")) || 0);
  
  const [activeTab, setActiveTab] = useState<"announcements" | "global" | "chats" | "feed" | "friends" | "profile" | "notifications" | "subject" | "games" | "voice" | "map">("chats");
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [viewingUserId, setViewingUserId] = useState<number>(currentUserId);
  const [targetChatUserId, setTargetChatUserId] = useState<number | null>(null);
  
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [unreadGlobalCount, setUnreadGlobalCount] = useState(0);
  const [unreadDmCount, setUnreadDmCount] = useState(0);

  // Announcements & Drop-down Modal State
  const [hasUnreadAnnouncement, setHasUnreadAnnouncement] = useState(false);
  const [activeAnnouncementModal, setActiveAnnouncementModal] = useState<AnnouncementItem | null>(null);
  const latestAnnouncementIdRef = useRef<number>(0);

  // Real-time Floating Toast Notifications with Stacking / Grouping
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const [activeDmChatUserId, setActiveDmChatUserId] = useState<number | null>(null);
  const activeDmChatUserIdRef = useRef<number | null>(null);

  const dismissToast = (id: string) => {
    const timer = toastTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const addToast = (incoming: {
    type: string;
    title?: string;
    text: string;
    senderId?: number | null;
    senderName?: string;
    senderAvatar?: string | null;
    senderColor?: string;
    target_id?: number | null;
    notifId?: number;
  }) => {
    const isDm = incoming.type === "new_message" || incoming.type === "dm";
    const senderId = incoming.senderId ? Number(incoming.senderId) : null;

    // 2. AKTİF SOHBETTE İKEN BİLDİRİMİ ENGELLE
    if (isDm && senderId && activeTabRef.current === "chats" && activeDmChatUserIdRef.current === senderId) {
      return;
    }

    const toastId = isDm && senderId ? `dm-notify-${senderId}` : `notif-${incoming.notifId || Math.random().toString(36).substring(2, 9)}`;

    setToasts((prevNotifications) => {
      // 1. Bu kullanıcıdan daha önce gelen açık bir bildirim kartı var mı?
      const existingIndex = prevNotifications.findIndex((n) => {
        if (isDm && senderId && n.senderId) {
          return Number(n.senderId) === senderId;
        }
        return n.id === toastId;
      });

      if (existingIndex !== -1) {
        // 2. Varsa: YENİ KART AÇMA, mevcut kartı güncelle (STACKLE)
        const updated = [...prevNotifications];
        const target = updated[existingIndex];

        // Reset auto-dismiss timer (6000ms)
        const existingTimer = toastTimersRef.current.get(target.id);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }
        const newTimer = setTimeout(() => {
          dismissToast(target.id);
        }, 6000);
        toastTimersRef.current.set(target.id, newTimer);

        updated[existingIndex] = {
          ...target,
          messages: [...(target.messages || []), incoming.text],
          lastMessage: incoming.text,
          unreadCount: (target.unreadCount || 1) + 1,
          timestamp: Date.now(),
          senderName: incoming.senderName || target.senderName,
          senderAvatar: incoming.senderAvatar || target.senderAvatar,
          notifId: incoming.notifId || target.notifId,
          target_id: incoming.target_id || target.target_id,
        };
        return updated;
      } else {
        // 3. Yoksa: İlk kez bir bildirim kartı oluştur
        const newToast: ToastItem = {
          id: toastId,
          type: incoming.type,
          senderId: senderId,
          senderName: incoming.senderName,
          senderAvatar: incoming.senderAvatar,
          senderColor: incoming.senderColor,
          title: incoming.title,
          messages: [incoming.text],
          lastMessage: incoming.text,
          unreadCount: 1,
          timestamp: Date.now(),
          target_id: incoming.target_id,
          notifId: incoming.notifId,
        };

        // Set auto-dismiss timer (6000ms)
        const timer = setTimeout(() => {
          dismissToast(toastId);
        }, 6000);
        toastTimersRef.current.set(toastId, timer);

        return [...prevNotifications, newToast];
      }
    });
  };

  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
    activeDmChatUserIdRef.current = activeTab === "chats" ? activeDmChatUserId : null;
  }, [activeTab, activeDmChatUserId]);

  const [darkMode, setDarkMode] = useState<boolean>(() => localStorage.getItem("lan_theme") === "dark");

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("lan_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const handleNotificationClick = (notif: any) => {
    if (notif.id) {
      dismissToast(notif.id);
    }
    if (notif.notifId && socket) {
      socket.emit("mark_single_notification_read", notif.notifId);
    } else if (notif.id && socket && typeof notif.id === "number") {
      socket.emit("mark_single_notification_read", notif.id);
    }
    setUnreadNotificationsCount((prev) => Math.max(0, prev - 1));

    const senderId = notif.senderId || notif.sender_id;
    if (notif.type === "new_message" || notif.type === "dm") {
      if (senderId) {
        setTargetChatUserId(senderId);
      }
      setActiveTab("chats");
    } else if (notif.type === "like" || notif.type === "comment") {
      setActiveTab("feed");
    } else if (notif.type === "follow" || notif.type === "friend_request" || notif.type === "friend_accept") {
      if (senderId) {
        setViewingUserId(senderId);
        setActiveTab("profile");
      }
    } else if (notif.type === "new_group_message" || notif.type === "group_invite") {
      setActiveTab("chats");
    } else {
      setActiveTab("notifications");
    }
  };

  useEffect(() => {
    if (token) {
      const socketUrl = getSocketUrl();
      const socketOptions = { 
        auth: { token },
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000
      };
      const newSocket = socketUrl ? io(socketUrl, socketOptions) : io(socketOptions);
      
      const onConnect = () => {
        setSocket(newSocket);
        newSocket.emit("heartbeat");
        newSocket.emit("get_notifications", (notifs: any[]) => {
          setUnreadNotificationsCount(notifs.filter(n => !n.read).length);
        });
        newSocket.emit("get_friends", (data: any[]) => {
          if (Array.isArray(data)) {
            const total = data.reduce((acc, f) => acc + (f.unreadCount || 0), 0);
            setUnreadDmCount(total);
          }
        });
      };

      newSocket.on("connect", onConnect);

      newSocket.on("connect_error", (err) => {
        if (err.message === "Invalid token" || err.message === "No token") {
          handleLogout();
        }
      });

      newSocket.on("online_users", (users: number[]) => {
        setOnlineUsers(users);
      });

      newSocket.on("your_id", (id: number) => {
        setCurrentUserId(id);
        setViewingUserId(id);
        localStorage.setItem("lan_user_id", id.toString());
      });
      
      newSocket.on("new_notification", (notif: any) => {
        setUnreadNotificationsCount(prev => prev + 1);
        if (notif && notif.content) {
          let title = "Yeni Bildirim";
          if (notif.type === "new_message") title = "Yeni Mesaj";
          else if (notif.type === "like") title = "Yeni Beğeni";
          else if (notif.type === "comment") title = "Yeni Yorum";
          else if (notif.type === "follow") title = "Yeni Takipçi";
          else if (notif.type === "friend_request") title = "Arkadaşlık İsteği";
          else if (notif.type === "friend_accept") title = "İstek Kabul Edildi";

          const colonIdx = notif.content.indexOf(":");
          const hasColon = colonIdx !== -1;
          const senderName = hasColon ? notif.content.substring(0, colonIdx).trim() : undefined;
          const text = hasColon ? notif.content.substring(colonIdx + 1).trim() : notif.content;

          addToast({
            type: notif.type,
            title,
            text,
            senderId: notif.sender_id,
            senderName,
            target_id: notif.target_id,
            notifId: notif.id,
          });
        }
      });

      newSocket.on("new_global_message", () => {
        if (activeTabRef.current !== 'global') {
          setUnreadGlobalCount(prev => prev + 1);
        }
      });

      newSocket.on("new_message", (msg: any) => {
        if (activeTabRef.current !== 'chats') {
          setUnreadDmCount(prev => prev + 1);
        }
      });

      // Announcements socket listeners & initial unread checking
      newSocket.on("new_announcement", (announcement: AnnouncementItem) => {
        if (announcement && announcement.id) {
          latestAnnouncementIdRef.current = Math.max(latestAnnouncementIdRef.current, Number(announcement.id));
          const lastRead = Number(localStorage.getItem("latest_read_announcement_id") || 0);
          if (Number(announcement.id) > lastRead) {
            setHasUnreadAnnouncement(true);
            setActiveAnnouncementModal(announcement);
          }
        }
      });

      // Initial check for unread announcements
      newSocket.emit("get_announcements", (res: any) => {
        if (res?.announcements && Array.isArray(res.announcements) && res.announcements.length > 0) {
          const newestId = Math.max(...res.announcements.map((a: any) => Number(a.id)));
          latestAnnouncementIdRef.current = newestId;
          const lastRead = Number(localStorage.getItem("latest_read_announcement_id") || 0);
          if (newestId > lastRead) {
            setHasUnreadAnnouncement(true);
          }
        }
      });

      // Handle mobile visibility change & window focus to immediately refresh presence and re-connect if needed
      const handleVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          if (!newSocket.connected) {
            newSocket.connect();
          } else {
            newSocket.emit("heartbeat");
          }
        }
      };

      const handleFocus = () => {
        if (!newSocket.connected) {
          newSocket.connect();
        } else {
          newSocket.emit("heartbeat");
        }
      };

      // Periodic heartbeat every 30s to keep socket alive and active
      const heartbeatInterval = setInterval(() => {
        if (newSocket.connected) {
          newSocket.emit("heartbeat");
        }
      }, 30000);

      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("focus", handleFocus);
      window.addEventListener("online", handleFocus);

      return () => {
        clearInterval(heartbeatInterval);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        window.removeEventListener("focus", handleFocus);
        window.removeEventListener("online", handleFocus);
        newSocket.disconnect();
      };
    }
  }, [token]);

  const handleAuthSuccess = (newToken: string, newUsername: string, newAvatar: string | null, id: number, newColor?: string) => {
    localStorage.setItem("lan_token", newToken);
    localStorage.setItem("lan_username", newUsername);
    localStorage.setItem("lan_user_id", id.toString());
    if(newAvatar) localStorage.setItem("lan_avatar", newAvatar);
    else localStorage.removeItem("lan_avatar");
    if(newColor) localStorage.setItem("lan_color", newColor);
    setToken(newToken);
    setUsername(newUsername);
    setAvatar(newAvatar);
    setColor(newColor);
    setCurrentUserId(id);
    setViewingUserId(id);
    window.location.reload();
  };

  const handleAvatarUpdated = (newAvatar: string) => {
    localStorage.setItem("lan_avatar", newAvatar);
    setAvatar(newAvatar);
  };

  const handleLogout = () => {
    localStorage.removeItem("lan_token");
    localStorage.removeItem("lan_username");
    localStorage.removeItem("lan_avatar");
    localStorage.removeItem("lan_user_id");
    setToken(null);
    if (socket) socket.disconnect();
    window.location.reload();
  };

  if (!token) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  const handleTabChange = (tab: "announcements" | "global" | "chats" | "feed" | "friends" | "profile" | "notifications" | "subject" | "games" | "voice" | "map") => {
    setActiveTab(tab);
    if (tab === "announcements") {
      setHasUnreadAnnouncement(false);
      if (latestAnnouncementIdRef.current > 0) {
        localStorage.setItem("latest_read_announcement_id", String(latestAnnouncementIdRef.current));
      }
    }
    if (tab === "global") {
      setUnreadGlobalCount(0);
    }
    if (tab === "profile") {
      setViewingUserId(currentUserId);
    }
    if (tab === "notifications" && socket) {
      socket.emit("mark_notifications_read");
      setUnreadNotificationsCount(0);
    }
    if (tab !== "subject") {
      setActiveSubject(null);
    }
  };

  const handleSubjectClick = (subject: string) => {
    setActiveSubject(subject);
    setActiveTab("subject");
  };

  const handleUserClick = (userId: number) => {
    setViewingUserId(userId);
    setActiveTab("profile");
  };

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] w-full max-w-[100vw] bg-white dark:bg-slate-900 md:bg-slate-50 md:dark:bg-slate-950 overflow-hidden font-sans transition-colors duration-200">
      {/* Semantic Top Heading for Search Crawlers & Accessibility */}
      <h1 className="sr-only">KapsApp - Canlı Harita ve Çevrimiçi Oyun Platformu</h1>

      {/* Floating Toast Notification Container */}
      <ToastContainer
        toasts={toasts}
        onDismiss={dismissToast}
        onClick={handleNotificationClick}
      />

      {/* Screen-center dropping animated Announcement Modal */}
      <AnnouncementModal
        announcement={activeAnnouncementModal}
        onClose={() => {
          if (activeAnnouncementModal) {
            localStorage.setItem("latest_read_announcement_id", String(activeAnnouncementModal.id));
            setHasUnreadAnnouncement(false);
          }
          setActiveAnnouncementModal(null);
        }}
        onGoToAnnouncements={() => {
          if (activeAnnouncementModal) {
            localStorage.setItem("latest_read_announcement_id", String(activeAnnouncementModal.id));
            setHasUnreadAnnouncement(false);
          }
          setActiveAnnouncementModal(null);
          handleTabChange("announcements");
        }}
      />

      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-24 lg:w-64 flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-colors duration-200">
        <div className="p-6">
          <h1 className="text-2xl font-black text-blue-600 tracking-tight hidden lg:block">KapsApp</h1>
          <h1 className="text-2xl font-black text-blue-600 tracking-tight lg:hidden">KA</h1>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <nav className="px-4 space-y-2">
            <NavItem 
              icon={<Megaphone className="text-amber-500 dark:text-amber-400" />} 
              label="Duyurular" 
              active={activeTab === 'announcements'} 
              dotBadge={hasUnreadAnnouncement} 
              onClick={() => handleTabChange('announcements')} 
            />
            <NavItem icon={<Globe />} label="Genel Sohbet" active={activeTab === 'global'} badge={unreadGlobalCount} onClick={() => handleTabChange('global')} />
            <NavItem icon={<MessageSquare />} label="Sohbetler" active={activeTab === 'chats'} badge={unreadDmCount} onClick={() => handleTabChange('chats')} />
            <NavItem icon={<LayoutGrid />} label="Akış" active={activeTab === 'feed'} onClick={() => handleTabChange('feed')} />
            <NavItem icon={<MapPin className="text-emerald-500" />} label="Canlı Harita" active={activeTab === 'map'} onClick={() => handleTabChange('map')} />
            <NavItem icon={<Users />} label="Arkadaşlar" active={activeTab === 'friends'} onClick={() => handleTabChange('friends')} />
            <NavItem icon={<Radio />} label="Sesli & Görüntülü" active={activeTab === 'voice'} onClick={() => handleTabChange('voice')} />
            <NavItem icon={<Gamepad2 />} label="Oyunlar" active={activeTab === 'games'} onClick={() => handleTabChange('games')} />
            <NavItem icon={<Bell />} label="Bildirimler" active={activeTab === 'notifications'} badge={unreadNotificationsCount} onClick={() => handleTabChange('notifications')} />
            <NavItem icon={<UserCircle2 />} label="Profil" active={activeTab === 'profile'} onClick={() => handleTabChange('profile')} />
          </nav>
          
          <div className="px-6 py-4 mt-4 hidden lg:block">
            <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Folders</h2>
            <div className="space-y-1">
              {SUBJECTS.map(subject => (
                <button
                  key={subject}
                  onClick={() => handleSubjectClick(subject)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                    activeSubject === subject 
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Folder size={16} className={activeSubject === subject ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'} />
                  <span className="truncate">{subject}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
           <button 
             onClick={() => setDarkMode(!darkMode)}
             className="w-full flex items-center justify-center lg:justify-start gap-3 p-3 rounded-xl transition-all text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
           >
             {darkMode ? <Sun size={20} className="text-amber-500" /> : <Moon size={20} className="text-indigo-500" />}
             <span className="hidden lg:block font-medium">{darkMode ? "Açık Tema" : "Koyu Tema"}</span>
           </button>
           
           <div className="hidden lg:block px-3 py-1 text-[11px] text-slate-400 dark:text-slate-500 text-center">
             <span>Uyar-Kaldır & Destek: </span>
             <a href="mailto:destekkapsapp@gmail.com" className="text-blue-500 hover:underline font-semibold">
               destekkapsapp@gmail.com
             </a>
           </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative w-full max-w-full overflow-hidden">
        {activeTab === 'announcements' && (
          <Announcements 
            socket={socket} 
            username={username} 
            currentUserId={currentUserId} 
            onAnnouncementsRead={(latestId) => {
              latestAnnouncementIdRef.current = latestId;
              localStorage.setItem("latest_read_announcement_id", String(latestId));
              setHasUnreadAnnouncement(false);
            }}
          />
        )}
        {activeTab === 'global' && <GlobalChat socket={socket} currentUserId={currentUserId} currentUsername={username} onlineUsers={onlineUsers} onUserClick={handleUserClick} />}
        {activeTab === 'chats' && (
          <Chats 
            socket={socket} 
            currentUserId={currentUserId} 
            currentUsername={username} 
            onlineUsers={onlineUsers} 
            onUserClick={handleUserClick} 
            onUnreadDMsChange={setUnreadDmCount}
            targetUserId={targetChatUserId}
            onTargetUserHandled={() => setTargetChatUserId(null)}
            onActiveChatUserChange={setActiveDmChatUserId}
          />
        )}
        {activeTab === 'feed' && <Feed socket={socket} currentUserId={currentUserId} currentUsername={username} onUserClick={handleUserClick} />}
        {activeTab === 'subject' && <Feed socket={socket} currentUserId={currentUserId} currentUsername={username} onUserClick={handleUserClick} activeSubject={activeSubject} />}
        {activeTab === 'friends' && <Friends socket={socket} currentUsername={username} onlineUsers={onlineUsers} onUserClick={handleUserClick} />}
        {activeTab === 'notifications' && <Notifications socket={socket} onNotificationClick={handleNotificationClick} />}
        {activeTab === 'profile' && (
          <Profile 
            socket={socket} 
            currentUserId={currentUserId} 
            viewingUserId={viewingUserId} 
            username={username} 
            avatar={avatar} 
            color={color} 
            onLogout={handleLogout} 
            onAvatarUpdated={handleAvatarUpdated} 
            onUserClick={handleUserClick}
            onOpenChat={(targetId) => {
              setTargetChatUserId(targetId);
              setActiveTab('chats');
            }}
          />
        )}
        
        {activeTab === 'map' && (
          <LiveMap 
            socket={socket} 
            currentUserId={currentUserId} 
            username={username} 
            avatar={avatar} 
            color={color} 
            onUserClick={handleUserClick}
            onOpenChat={(targetId) => {
              setTargetChatUserId(targetId);
              setActiveTab('chats');
            }}
          />
        )}
        
        {/* Persistently mounted Voice Chat tab to preserve audio connection when switching tabs */}
        <div className={`flex-1 flex-col relative w-full h-full ${activeTab === 'voice' ? 'flex' : 'hidden'}`}>
          <VoiceChat socket={socket} currentUserId={currentUserId} currentUsername={username} avatar={avatar} color={color} onUserClick={handleUserClick} />
        </div>

        {/* Persistently mounted Games tab to preserve room and game state when navigating */}
        <div className={`flex-1 flex-col relative w-full h-full ${activeTab === 'games' ? 'flex' : 'hidden'}`}>
          <Games socket={socket} currentUserId={currentUserId} username={username} avatar={avatar} color={color} onUserClick={handleUserClick} />
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md pb-safe shrink-0 z-30">
        <nav className="flex items-center justify-around px-1 py-1.5 overflow-x-auto no-scrollbar">
          <MobileNavItem icon={<Megaphone size={22} className="text-amber-500" />} active={activeTab === 'announcements'} dotBadge={hasUnreadAnnouncement} onClick={() => handleTabChange('announcements')} />
          <MobileNavItem icon={<Globe size={22} />} active={activeTab === 'global'} badge={unreadGlobalCount} onClick={() => handleTabChange('global')} />
          <MobileNavItem icon={<MessageSquare size={22} />} active={activeTab === 'chats'} badge={unreadDmCount} onClick={() => handleTabChange('chats')} />
          <MobileNavItem icon={<LayoutGrid size={22} />} active={activeTab === 'feed'} onClick={() => handleTabChange('feed')} />
          <MobileNavItem icon={<MapPin size={22} className="text-emerald-500" />} active={activeTab === 'map'} onClick={() => handleTabChange('map')} />
          <MobileNavItem icon={<Radio size={22} />} active={activeTab === 'voice'} onClick={() => handleTabChange('voice')} />
          <MobileNavItem icon={<Gamepad2 size={22} />} active={activeTab === 'games'} onClick={() => handleTabChange('games')} />
          <MobileNavItem icon={<Users size={22} />} active={activeTab === 'friends'} onClick={() => handleTabChange('friends')} />
          <MobileNavItem icon={<Bell size={22} />} active={activeTab === 'notifications'} badge={unreadNotificationsCount} onClick={() => handleTabChange('notifications')} />
          <MobileNavItem icon={<UserCircle2 size={22} />} active={activeTab === 'profile'} onClick={() => handleTabChange('profile')} />
        </nav>
      </div>
    </div>
  );
}

function NavItem({ icon, label, active, badge, dotBadge, onClick }: { icon: React.ReactNode, label: string, active: boolean, badge?: number, dotBadge?: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-between p-3 lg:px-4 rounded-xl transition-all relative cursor-pointer ${active ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
    >
      <div className="flex items-center gap-4">
        <div className={`relative ${active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-500'}`}>
          {icon}
          {badge && badge > 0 && <div className="lg:hidden absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-white dark:border-slate-900"></div>}
          {dotBadge && !badge && <div className="lg:hidden absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-white dark:border-slate-900 animate-pulse"></div>}
        </div>
        <span className="hidden lg:block">{label}</span>
      </div>
      {badge && badge > 0 ? (
         <span className="hidden lg:flex px-1.5 min-w-[20px] h-5 bg-red-500 text-white text-[10px] items-center justify-center rounded-full font-bold shadow-sm">
           {badge > 99 ? '99+' : badge}
         </span>
      ) : dotBadge ? (
        <span className="hidden lg:flex w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-sm shadow-red-500/50"></span>
      ) : null}
    </button>
  );
}

function MobileNavItem({ icon, active, badge, dotBadge, onClick }: { icon: React.ReactNode, active: boolean, badge?: number, dotBadge?: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5 rounded-xl transition-all relative cursor-pointer ${active ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
    >
      {icon}
      {badge && badge > 0 ? (
        <span className="absolute top-1 right-1 px-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold flex items-center justify-center rounded-full border border-white dark:border-slate-900 leading-none shadow-sm">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : dotBadge ? (
        <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse shadow-sm shadow-red-500/50"></span>
      ) : null}
    </button>
  );
}

