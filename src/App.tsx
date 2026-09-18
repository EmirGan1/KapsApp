import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { MessageSquare, LayoutGrid, Users, UserCircle2, Globe, Bell, Folder, Moon, Sun } from "lucide-react";
import Auth from "./components/Auth";
import Feed from "./components/Feed";
import Chats from "./components/Chats";
import Friends from "./components/Friends";
import Profile from "./components/Profile";
import GlobalChat from "./components/GlobalChat";
import Notifications from "./components/Notifications";

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
  
  const [activeTab, setActiveTab] = useState<"global" | "chats" | "feed" | "friends" | "profile" | "notifications" | "subject">("chats");
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [viewingUserId, setViewingUserId] = useState<number>(currentUserId);
  
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  const [darkMode, setDarkMode] = useState<boolean>(() => localStorage.getItem("lan_theme") === "dark");

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("lan_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("lan_theme", "light");
    }
  }, [darkMode]);

  useEffect(() => {
    if (token) {
      const newSocket = io({ auth: { token } });
      
      newSocket.on("connect", () => {
        setSocket(newSocket);
        newSocket.emit("get_notifications", (notifs: any[]) => {
          setUnreadNotificationsCount(notifs.filter(n => !n.read).length);
        });
      });

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

  const handleTabChange = (tab: "global" | "chats" | "feed" | "friends" | "profile" | "notifications" | "subject") => {
    setActiveTab(tab);
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
    <div className="flex h-screen bg-white dark:bg-slate-900 md:bg-slate-50 md:dark:bg-slate-950 overflow-hidden font-sans transition-colors duration-200">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-24 lg:w-64 flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-colors duration-200">
        <div className="p-6">
          <h1 className="text-2xl font-black text-blue-600 tracking-tight hidden lg:block">KapsApp</h1>
          <h1 className="text-2xl font-black text-blue-600 tracking-tight lg:hidden">KA</h1>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <nav className="px-4 space-y-2">
            <NavItem icon={<Globe />} label="Genel Sohbet" active={activeTab === 'global'} onClick={() => handleTabChange('global')} />
            <NavItem icon={<MessageSquare />} label="Sohbetler" active={activeTab === 'chats'} onClick={() => handleTabChange('chats')} />
            <NavItem icon={<LayoutGrid />} label="Akış" active={activeTab === 'feed'} onClick={() => handleTabChange('feed')} />
            <NavItem icon={<Users />} label="Arkadaşlar" active={activeTab === 'friends'} onClick={() => handleTabChange('friends')} />
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

        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
           <button 
             onClick={() => setDarkMode(!darkMode)}
             className="w-full flex items-center justify-center lg:justify-start gap-3 p-3 rounded-xl transition-all text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
           >
             {darkMode ? <Sun size={20} className="text-amber-500" /> : <Moon size={20} className="text-indigo-500" />}
             <span className="hidden lg:block font-medium">{darkMode ? "Light Mode" : "Dark Mode"}</span>
           </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative w-full max-w-full">
        {activeTab === 'global' && <GlobalChat socket={socket} currentUserId={currentUserId} onlineUsers={onlineUsers} onUserClick={handleUserClick} />}
        {activeTab === 'chats' && <Chats socket={socket} currentUserId={currentUserId} onlineUsers={onlineUsers} onUserClick={handleUserClick} />}
        {activeTab === 'feed' && <Feed socket={socket} currentUserId={currentUserId} onUserClick={handleUserClick} />}
        {activeTab === 'subject' && <Feed socket={socket} currentUserId={currentUserId} onUserClick={handleUserClick} activeSubject={activeSubject} />}
        {activeTab === 'friends' && <Friends socket={socket} currentUsername={username} onlineUsers={onlineUsers} onUserClick={handleUserClick} />}
        {activeTab === 'notifications' && <Notifications socket={socket} />}
        {activeTab === 'profile' && <Profile socket={socket} currentUserId={currentUserId} viewingUserId={viewingUserId} username={username} avatar={avatar} color={color} onLogout={handleLogout} onAvatarUpdated={handleAvatarUpdated} onUserClick={handleUserClick} />}
      </div>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md pb-safe">
        <nav className="flex justify-around p-3">
          <MobileNavItem icon={<Globe />} active={activeTab === 'global'} onClick={() => handleTabChange('global')} />
          <MobileNavItem icon={<MessageSquare />} active={activeTab === 'chats'} onClick={() => handleTabChange('chats')} />
          <MobileNavItem icon={<LayoutGrid />} active={activeTab === 'feed'} onClick={() => handleTabChange('feed')} />
          <MobileNavItem icon={<Folder />} active={activeTab === 'subject'} onClick={() => handleSubjectClick("Turkish")} />
          <MobileNavItem icon={<Users />} active={activeTab === 'friends'} onClick={() => handleTabChange('friends')} />
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
      className={`w-full flex items-center justify-between p-3 lg:px-4 rounded-xl transition-all relative ${active ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
    >
      <div className="flex items-center gap-4">
        <div className={`relative ${active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-500'}`}>
          {icon}
          {badge && badge > 0 && <div className="lg:hidden absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-white dark:border-slate-900"></div>}
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
      className={`p-3 rounded-xl transition-all relative ${active ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
    >
      {icon}
      {badge && badge > 0 && <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></div>}
    </button>
  );
}

