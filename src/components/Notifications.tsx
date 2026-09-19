import { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import { 
  Bell, MessageSquare, UserPlus, UserCheck, Heart, MessageCircle, Users, CheckCheck, Sparkles 
} from "lucide-react";
import { AppNotification } from "../types";

export default function Notifications({
  socket,
  onNotificationClick,
}: {
  socket: Socket | null;
  onNotificationClick?: (notif: AppNotification) => void;
}) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = () => {
    if (!socket) return;
    socket.emit("get_notifications", (data: AppNotification[]) => {
      setNotifications(data || []);
      setLoading(false);
    });
  };

  useEffect(() => {
    if (!socket) return;

    fetchNotifications();

    const onNewNotification = (notif: AppNotification) => {
      setNotifications((prev) => [notif, ...prev.filter((n) => n.id !== notif.id)]);
    };

    const onNotificationsUpdated = () => {
      fetchNotifications();
    };

    socket.on("new_notification", onNewNotification);
    socket.on("notifications_updated", onNotificationsUpdated);

    return () => {
      socket.off("new_notification", onNewNotification);
      socket.off("notifications_updated", onNotificationsUpdated);
    };
  }, [socket]);

  const handleMarkAllRead = () => {
    if (!socket) return;
    socket.emit("mark_notifications_read");
    setNotifications((prev) => prev.map((n) => ({ ...n, read: 1 })));
  };

  const handleItemClick = (notif: AppNotification) => {
    if (!notif.read && socket) {
      socket.emit("mark_single_notification_read", notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: 1 } : n))
      );
    }
    if (onNotificationClick) {
      onNotificationClick(notif);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "new_message":
      case "dm":
        return (
          <div className="p-2.5 bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl shrink-0">
            <MessageSquare size={18} />
          </div>
        );
      case "like":
        return (
          <div className="p-2.5 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-xl shrink-0">
            <Heart size={18} className="fill-rose-500 text-rose-500" />
          </div>
        );
      case "comment":
        return (
          <div className="p-2.5 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
            <MessageCircle size={18} />
          </div>
        );
      case "follow":
      case "friend_request":
        return (
          <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
            <UserPlus size={18} />
          </div>
        );
      case "friend_accept":
        return (
          <div className="p-2.5 bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 rounded-xl shrink-0">
            <UserCheck size={18} />
          </div>
        );
      case "new_group_message":
      case "group_invite":
        return (
          <div className="p-2.5 bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 rounded-xl shrink-0">
            <Users size={18} />
          </div>
        );
      default:
        return (
          <div className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl shrink-0">
            <Bell size={18} />
          </div>
        );
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell size={20} className="text-blue-600 dark:text-blue-400" />
          <h2 className="font-bold text-lg text-slate-800 dark:text-slate-100">Bildirimler</h2>
          {unreadCount > 0 && (
            <span className="text-xs font-bold text-white bg-blue-600 px-2 py-0.5 rounded-full">
              {unreadCount} yeni
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-3 py-1.5 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors cursor-pointer"
          >
            <CheckCheck size={15} />
            <span>Tümünü Okundu Say</span>
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 max-w-3xl mx-auto w-full">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-2">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs">Bildirimler yükleniyor...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-80 text-slate-400 gap-4">
            <div className="w-16 h-16 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-center justify-center shadow-sm">
              <Sparkles size={28} className="text-slate-300 dark:text-slate-600" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">Henüz bildirim yok</p>
              <p className="text-xs text-slate-400 mt-1">Arkadaşlık istekleri, mesajlar ve beğeniler burada görünür.</p>
            </div>
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleItemClick(notif)}
              className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 shadow-sm hover:shadow-md ${
                !notif.read
                  ? "bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-900/50 ring-1 ring-blue-500/20"
                  : "bg-white/80 dark:bg-slate-900/60 border-slate-100 dark:border-slate-800/80 hover:bg-white dark:hover:bg-slate-900"
              }`}
            >
              {getIcon(notif.type)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm ${!notif.read ? 'font-bold text-slate-900 dark:text-slate-100' : 'font-medium text-slate-700 dark:text-slate-300'} leading-snug`}>
                    {notif.content}
                  </p>
                  {!notif.read && (
                    <span className="w-2.5 h-2.5 bg-blue-600 rounded-full shrink-0 shadow-sm shadow-blue-500/50"></span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    {new Date(notif.created_at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                    Görüntüle →
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
