import React from "react";
import { motion, AnimatePresence } from "motion/react";
import DOMPurify from "dompurify";
import { Megaphone, X, ShieldAlert, Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";
import { AnnouncementItem } from "./Announcements";

interface AnnouncementModalProps {
  announcement: AnnouncementItem | null;
  onClose: () => void;
  onGoToAnnouncements: () => void;
}

export default function AnnouncementModal({
  announcement,
  onClose,
  onGoToAnnouncements
}: AnnouncementModalProps) {
  if (!announcement) return null;

  const formattedDate = new Date(announcement.created_at || Date.now()).toLocaleString("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short"
  });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 select-text">
        {/* Backdrop blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-md cursor-pointer"
        />

        {/* Drop-down Animated Modal from Screen Top */}
        <motion.div
          initial={{ y: -500, opacity: 0, scale: 0.85 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -500, opacity: 0, scale: 0.85 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 24,
            mass: 0.8
          }}
          className="relative w-full max-w-lg bg-white dark:bg-slate-900 border-2 border-blue-500/50 rounded-3xl shadow-2xl shadow-blue-500/20 overflow-hidden z-10 flex flex-col max-h-[85vh]"
        >
          {/* Glowing Animated Top Header */}
          <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 p-5 text-white flex items-center justify-between overflow-hidden">
            {/* Background sparkle shapes */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
            
            <div className="flex items-center gap-3 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-lg shadow-black/20 shrink-0">
                <Megaphone size={24} className="text-amber-300 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1">
                    <Sparkles size={13} /> Yeni Resmi Duyuru
                  </span>
                </div>
                <h3 className="font-extrabold text-base sm:text-lg text-white leading-tight">
                  {announcement.title}
                </h3>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 flex items-center justify-center text-white transition-colors relative z-10 cursor-pointer"
              title="Kapat"
            >
              <X size={18} />
            </button>
          </div>

          {/* Author info strip */}
          <div className="px-6 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {announcement.author_username}
              </span>
              <span className="text-[10px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold px-2 py-0.5 rounded-full border border-indigo-500/20 flex items-center gap-0.5">
                <ShieldAlert size={10} /> Yönetici
              </span>
            </div>
            <span>{formattedDate}</span>
          </div>

          {/* Formatted Rich HTML Content */}
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            <div
              className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed prose prose-sm dark:prose-invert max-w-none break-words"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(announcement.content)
              }}
            />
          </div>

          {/* Action Footer */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-end gap-2.5">
            <button
              onClick={onGoToAnnouncements}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Duyurular Sayfasına Git</span>
              <ArrowRight size={15} />
            </button>
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/25 transition-all cursor-pointer"
            >
              <CheckCircle2 size={16} />
              <span>Okudum & Kapat</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
