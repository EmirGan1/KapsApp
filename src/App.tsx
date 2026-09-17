import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { MessageSquare, LayoutGrid, Users, UserCircle2, Globe, Bell } from "lucide-react";
import Auth from "./components/Auth";
import Feed from "./components/Feed";
import Chats from "./components/Chats";
import Friends from "./components/Friends";
import Profile from "./components/Profile";
import GlobalChat from "./components/GlobalChat";
import Notifications from "./components/Notifications";

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
  
  const [activeTab, setActiveTab] = useState<"global" | "chats" | "feed" | "friends" | "profile" | "notifications">("chats");
  const [viewingUserId, setViewingUserId] = useState<number>(currentUserId);
  
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  useEffect(() => {
    if (token) {
      const newSocket = io({ auth: { token } });
      
      newSocket.on("connect", () => {
        setSocket(newSocket);
        newSocket.emit("get_notifications", (notifs: any[]) => {
          setUnreadNotificationsCount(notifs.filter(n => !n.read).length);
        });
      });

      newSocket.on("connect_error", () => {
        handleLogout();
      });

      newSocket.on("online_users", (users: number[]) => {
        setOnlineUsers(users);
      });

      newSocket.on("your_id", (id: number) => {
        setCurrentUserId(id);
        setViewingUserId(id);
        localStorage.setItem("lan_user_id", id.toString());
      });
      
      newSocket.on("new_notification", () => {
        setUnreadNotificationsCount(prev => prev + 1);
      });

      return () => {
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

  const handleTabChange = (tab: "global" | "chats" | "feed" | "friends" | "profile" | "notifications") => {
    setActiveTab(tab);
    if (tab === "profile") {
      setViewingUserId(currentUserId);
    }
    if (tab === "notifications" && socket) {
      socket.emit("mark_notifications_read");
      setUnreadNotificationsCount(0);
    }
  };

  const handleUserClick = (userId: number) => {
    setViewingUserId(userId);
    setActiveTab("profile");
  };

  return (
    <div className="flex h-screen bg-white md:bg-slate-50 overflow-hidden font-sans">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-24 lg:w-64 flex-col bg-white border-r border-slate-200">
        <div className="p-6">
          <h1 className="text-2xl font-black text-blue-600 tracking-tight hidden lg:block">KapsApp</h1>
          <h1 className="text-2xl font-black text-blue-600 tracking-tight lg:hidden">KA</h1>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <NavItem icon={<Globe />} label="Genel Sohbet" active={activeTab === 'global'} onClick={() => handleTabChange('global')} />
          <NavItem icon={<MessageSquare />} label="Sohbetler" active={activeTab === 'chats'} onClick={() => handleTabChange('chats')} />
          <NavItem icon={<LayoutGrid />} label="Akış" active={activeTab === 'feed'} onClick={() => handleTabChange('feed')} />
          <NavItem icon={<Users />} label="Arkadaşlar" active={activeTab === 'friends'} onClick={() => handleTabChange('friends')} />
          <NavItem icon={<Bell />} label="Bildirimler" active={activeTab === 'notifications'} badge={unreadNotificationsCount} onClick={() => handleTabChange('notifications')} />
          <NavItem icon={<UserCircle2 />} label="Profil" active={activeTab === 'profile'} onClick={() => handleTabChange('profile')} />
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative w-full max-w-full">
        {activeTab === 'global' && <GlobalChat socket={socket} currentUserId={currentUserId} onlineUsers={onlineUsers} onUserClick={handleUserClick} />}
        {activeTab === 'chats' && <Chats socket={socket} currentUserId={currentUserId} onlineUsers={onlineUsers} onUserClick={handleUserClick} />}
        {activeTab === 'feed' && <Feed socket={socket} currentUserId={currentUserId} onUserClick={handleUserClick} />}
        {activeTab === 'friends' && <Friends socket={socket} currentUsername={username} onlineUsers={onlineUsers} onUserClick={handleUserClick} />}
        {activeTab === 'notifications' && <Notifications socket={socket} />}
        {activeTab === 'profile' && <Profile socket={socket} currentUserId={currentUserId} viewingUserId={viewingUserId} username={username} avatar={avatar} color={color} onLogout={handleLogout} onAvatarUpdated={handleAvatarUpdated} onUserClick={handleUserClick} />}
      </div>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden border-t border-slate-200 bg-white/80 backdrop-blur-md pb-safe">
        <nav className="flex justify-around p-3">
          <MobileNavItem icon={<Globe />} active={activeTab === 'global'} onClick={() => handleTabChange('global')} />
          <MobileNavItem icon={<MessageSquare />} active={activeTab === 'chats'} onClick={() => handleTabChange('chats')} />
          <MobileNavItem icon={<LayoutGrid />} active={activeTab === 'feed'} onClick={() => handleTabChange('feed')} />
          <MobileNavItem icon={<Users />} active={activeTab === 'friends'} onClick={() => handleTabChange('friends')} />
          <MobileNavItem icon={<Bell />} active={activeTab === 'notifications'} badge={unreadNotificationsCount} onClick={() => handleTabChange('notifications')} />
          <MobileNavItem icon={<UserCircle2 />} active={activeTab === 'profile'} onClick={() => handleTabChange('profile')} />
        </nav>
      </div>
    </div>
  );
}

function NavItem({ icon, label, active, badge, onClick }: { icon: React.ReactNode, label: string, active: boolean, badge?: number, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-between p-3 lg:px-4 rounded-xl transition-all relative ${active ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
    >
      <div className="flex items-center gap-4">
        <div className={`relative ${active ? 'text-blue-600' : 'text-slate-500'}`}>
          {icon}
          {badge && badge > 0 && <div className="lg:hidden absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-white"></div>}
        </div>
        <span className="hidden lg:block">{label}</span>
      </div>
      {badge && badge > 0 && (
         <span className="hidden lg:flex w-5 h-5 bg-red-500 text-white text-[10px] items-center justify-center rounded-full font-bold">
           {badge > 9 ? '9+' : badge}
         </span>
      )}
    </button>
  );
}

function MobileNavItem({ icon, active, badge, onClick }: { icon: React.ReactNode, active: boolean, badge?: number, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`p-3 rounded-xl transition-all relative ${active ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
    >
      {icon}
      {badge && badge > 0 && <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></div>}
    </button>
  );
}

