import React from "react";
import { MessageSquare, Heart, MessageCircle, UserPlus, UserCheck, Bell, Users, X } from "lucide-react";

export interface ToastItem {
  id: string;
  type: string;
  title?: string;
  message: string;
  sender_id?: number | null;
  target_id?: number | null;
  notifId?: number;
  count?: number;
}

export default function ToastContainer({
  toasts,
  onDismiss,
  onClick,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  onClick: (toast: ToastItem) => void;
}) {
  if (toasts.length === 0) return null;

  const getToastIcon = (type: string) => {
    switch (type) {
      case "new_message":
      case "dm":
        return (
          <div className="p-2 bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl shrink-0">
            <MessageSquare size={18} />
          </div>
        );
      case "like":
        return (
          <div className="p-2 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-xl shrink-0">
            <Heart size={18} className="fill-rose-500 text-rose-500" />
          </div>
        );
      case "comment":
        return (
          <div className="p-2 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
            <MessageCircle size={18} />
          </div>
        );
      case "follow":
      case "friend_request":
        return (
          <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
            <UserPlus size={18} />
          </div>
        );
      case "friend_accept":
        return (
          <div className="p-2 bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 rounded-xl shrink-0">
            <UserCheck size={18} />
          </div>
        );
      case "new_group_message":
      case "group_invite":
        return (
          <div className="p-2 bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 rounded-xl shrink-0">
            <Users size={18} />
          </div>
        );
      default:
        return (
          <div className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl shrink-0">
            <Bell size={18} />
          </div>
        );
    }
  };

  return (
    <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-50 flex flex-col gap-2.5 pointer-events-none">
      {toasts.map((toast) => {
        const colonIdx = toast.message.indexOf(":");
        const hasSenderColon = colonIdx !== -1;
        const sender = hasSenderColon ? toast.message.substring(0, colonIdx).trim() : "";
        const restMsg = hasSenderColon ? toast.message.substring(colonIdx + 1).trim() : toast.message;

        return (
          <div
            key={toast.id}
            onClick={() => onClick(toast)}
            className="pointer-events-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xl hover:shadow-2xl flex items-start gap-3 cursor-pointer transition-all duration-200 transform hover:-translate-y-0.5 animate-in slide-in-from-top-3 fade-in"
          >
            {getToastIcon(toast.type)}
            
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center gap-1.5 mb-0.5">
                {toast.title && (
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider truncate">
                    {toast.title}
                  </h4>
                )}
                {toast.count && toast.count > 1 ? (
                  <span className="px-1.5 py-0.2 bg-blue-600 dark:bg-blue-500 text-white rounded-full text-[10px] font-extrabold shadow-sm shrink-0">
                    +{toast.count}
                  </span>
                ) : null}
              </div>

              {hasSenderColon && toast.count && toast.count > 1 ? (
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 font-medium leading-snug line-clamp-2">
                  <span className="font-bold text-slate-900 dark:text-white">{sender} ({toast.count}):</span> {restMsg}
                </p>
              ) : (
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 font-medium leading-snug line-clamp-2">
                  {toast.message}
                </p>
              )}

              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold mt-1 inline-block">
                Görüntülemek için tıkla →
              </span>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(toast.id);
              }}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
