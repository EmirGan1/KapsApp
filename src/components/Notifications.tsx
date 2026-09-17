import { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import { Bell, MessageSquare, UserPlus, Users } from "lucide-react";

export default function Notifications({ socket }: { socket: Socket | null }) {
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (socket) {
      socket.emit("get_notifications", (data: any[]) => {
        setNotifications(data);
      });

      const onNewNotification = (notif: any) => {
        setNotifications(prev => [notif, ...prev]);
      };

      socket.on("new_notification", onNewNotification);
      return () => {
        socket.off("new_notification", onNewNotification);
      };
    }
  }, [socket]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'new_message': return <MessageSquare size={20} className="text-blue-500" />;
      case 'new_group_message': return <Users size={20} className="text-indigo-500" />;
      case 'friend_request':
      case 'friend_accept': return <UserPlus size={20} className="text-green-500" />;
      case 'group_invite': return <Users size={20} className="text-purple-500" />;
      default: return <Bell size={20} className="text-slate-500" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-4 border-b border-slate-200 bg-white shadow-sm z-10 flex items-center justify-between">
        <h2 className="font-bold text-lg text-slate-800">Bildirimler</h2>
        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{notifications.length} Toplam</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {notifications.length === 0 ? (
           <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
             <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
               <Bell size={32} className="text-slate-300" />
             </div>
             <p>Henüz bir bildiriminiz yok.</p>
           </div>
        ) : (
          notifications.map(notif => (
            <div key={notif.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-start gap-4">
              <div className="p-2 bg-slate-50 rounded-full">
                {getIcon(notif.type)}
              </div>
              <div className="flex-1">
                <p className="text-slate-800 font-medium text-[15px]">{notif.content}</p>
                <span className="text-xs text-slate-400 mt-1 block">
                  {new Date(notif.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
