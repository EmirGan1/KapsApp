import React, { useState } from "react";
import { MessageSquare, Heart, MessageCircle, UserPlus, UserCheck, Bell, Users, X, ChevronDown, ChevronUp, ArrowRight } from "lucide-react";

export interface ToastItem {
  id: string;
  type: string;
  senderId?: number | null;
  senderName?: string;
  senderAvatar?: string | null;
  senderColor?: string;
  title?: string;
  messages: string[];
  lastMessage: string;
  unreadCount: number;
  timestamp: number;
  target_id?: number | null;
  notifId?: number;
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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  if (toasts.length === 0) return null;

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getToastIcon = (type: string) => {
    switch (type) {
      case "new_message":
      case "dm":
        return (
          <div className="p-2.5 bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 rounded-2xl shrink-0 shadow-sm">
            <MessageSquare size={18} />
          </div>
        );
      case "like":
        return (
          <div className="p-2.5 bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 rounded-2xl shrink-0 shadow-sm">
            <Heart size={18} className="fill-rose-500 text-rose-500" />
          </div>
        );
      case "comment":
        return (
          <div className="p-2.5 bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 rounded-2xl shrink-0 shadow-sm">
            <MessageCircle size={18} />
          </div>
        );
      case "follow":
      case "friend_request":
        return (
          <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 rounded-2xl shrink-0 shadow-sm">
            <UserPlus size={18} />
          </div>
        );
      case "friend_accept":
        return (
          <div className="p-2.5 bg-teal-100 dark:bg-teal-950/70 text-teal-600 dark:text-teal-400 rounded-2xl shrink-0 shadow-sm">
            <UserCheck size={18} />
          </div>
        );
      case "new_group_message":
      case "group_invite":
        return (
          <div className="p-2.5 bg-purple-100 dark:bg-purple-950/70 text-purple-600 dark:text-purple-400 rounded-2xl shrink-0 shadow-sm">
            <Users size={18} />
          </div>
        );
      default:
        return (
          <div className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl shrink-0 shadow-sm">
            <Bell size={18} />
          </div>
        );
    }
  };

  return (
    <div
      id="toast-notification-container"
      className="fixed top-4 right-3 left-3 sm:left-auto sm:right-4 sm:w-[380px] z-50 flex flex-col gap-2.5 pointer-events-none"
    >
      {toasts.map((toast) => {
        const isDm = toast.type === "new_message" || toast.type === "dm";
        const isExpanded = expandedIds.has(toast.id);
        const hasMultipleMessages = (toast.unreadCount > 1) || (toast.messages && toast.messages.length > 1);

        return (
          <div
            key={toast.senderId ? `dm-sender-${toast.senderId}` : toast.id}
            id={`toast-item-${toast.id}`}
            onClick={() => onClick(toast)}
            className="pointer-events-auto transition-all duration-200 ease-out bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 shadow-xl hover:shadow-2xl cursor-pointer relative overflow-hidden group"
          >
            {/* Top Row: Icon, Sender / Title, Actions */}
            <div className="flex items-start gap-3">
              {getToastIcon(toast.type)}

              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Title or Sender Name */}
                  {isDm ? (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
                        {toast.senderName || toast.title || "Yeni Mesaj"}
                      </span>
                      {hasMultipleMessages && (
                        <span className="px-2 py-0.5 bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25 rounded-full text-[10px] font-extrabold shadow-sm shrink-0 whitespace-nowrap">
                          {toast.unreadCount} mesaj
                        </span>
                      )}
                    </div>
                  ) : (
                    <>
                      {toast.title && (
                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider truncate">
                          {toast.title}
                        </h4>
                      )}
                      {hasMultipleMessages && (
                        <span className="px-1.5 py-0.5 bg-blue-600 dark:bg-blue-500 text-white rounded-full text-[10px] font-extrabold shadow-sm shrink-0">
                          +{toast.unreadCount}
                        </span>
                      )}
                    </>
                  )}
                </div>

                {/* Compact Preview of Latest Message */}
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 font-medium leading-snug line-clamp-2 mt-0.5">
                  {toast.lastMessage}
                </p>

                {!isExpanded && (
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 mt-1">
                    <span>{isDm ? "Sohbete git" : "Görüntüle"}</span>
                    <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                  </div>
                )}
              </div>

              {/* Right Action Buttons */}
              <div className="flex items-start gap-1 shrink-0 -mr-1 -mt-1">
                {/* Expand / Collapse Chevron Button with "Tümünü gör" / "Gizle" text */}
                {isDm && hasMultipleMessages && (
                  <button
                    type="button"
                    id={`toast-accordion-btn-${toast.id}`}
                    onClick={(e) => toggleExpand(toast.id, e)}
                    className="flex flex-col items-center justify-center p-1.5 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors shrink-0"
                    title={isExpanded ? "Gizle" : "Tümünü gör"}
                    aria-label={isExpanded ? "Gizle" : "Tümünü gör"}
                  >
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    <span className="text-[9px] font-semibold leading-none mt-0.5 tracking-tight select-none">
                      {isExpanded ? "Gizle" : "Tümünü gör"}
                    </span>
                  </button>
                )}

                {/* Dismiss ("X") Button */}
                <button
                  type="button"
                  id={`toast-dismiss-btn-${toast.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss(toast.id);
                  }}
                  className="p-1.5 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  title="Bildirimi Kapat"
                  aria-label="Bildirimi Kapat"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Açılır Alt Sekme (Gizli / Önceki Mesajlar) */}
            {isExpanded && toast.messages && toast.messages.length > 1 && (
              <div
                id={`toast-expanded-panel-${toast.id}`}
                className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 transition-all duration-200 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                  Önceki Mesajlar ({toast.messages.length - 1})
                </div>
                
                {/* Alt Liste: Girintili, farklı arka plan tonu ve sol dikey çizgi */}
                <div className="ml-1 pl-3 border-l-2 border-blue-500 dark:border-blue-400 flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
                  {toast.messages.slice(0, -1).map((msgText, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 font-medium break-words shadow-xs"
                    >
                      {msgText}
                    </div>
                  ))}
                </div>

                <div
                  onClick={() => onClick(toast)}
                  className="mt-2.5 flex items-center justify-between text-[11px] font-semibold text-blue-600 dark:text-blue-400 cursor-pointer hover:underline pt-1"
                >
                  <span className="flex items-center gap-1">
                    Sohbete git <ArrowRight size={12} />
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    Cevaplamak için tıkla
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
