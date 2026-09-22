import React, { useState, useEffect } from "react";
import { X, Heart, Send, Download, MessageCircle, Calendar, Film, Image as ImageIcon, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import Avatar from "./Avatar";
import { MediaModalData } from "../types";

interface MediaModalProps {
  data: MediaModalData | null;
  onClose: () => void;
  onUserClick?: (id: number) => void;
}

export default function MediaModal({ data, onClose, onUserClick }: MediaModalProps) {
  const [commentText, setCommentText] = useState("");
  const [zoomScale, setZoomScale] = useState(1);

  useEffect(() => {
    setZoomScale(1);
  }, [data?.url]);

  const handleZoomIn = () => setZoomScale((s) => Math.min(s + 0.35, 3.5));
  const handleZoomOut = () => setZoomScale((s) => Math.max(s - 0.35, 0.6));
  const handleResetZoom = () => setZoomScale(1);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!data) return null;

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !data.onAddComment) return;
    data.onAddComment(commentText.trim());
    setCommentText("");
  };

  const formattedDate = data.timestamp
    ? new Date(data.timestamp).toLocaleString("tr-TR", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";

  return (
    <div
      id="media-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-0 md:p-6 select-none animate-fadeIn"
      onClick={(e) => {
        if ((e.target as HTMLElement).id === "media-modal-backdrop") {
          onClose();
        }
      }}
    >
      {/* Close button top right */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 text-white/80 hover:text-white bg-black/40 hover:bg-black/70 p-2 rounded-full backdrop-blur-sm transition-colors cursor-pointer"
        title="Kapat (Esc)"
      >
        <X size={24} />
      </button>

      {/* Modal Container */}
      <div className="bg-black md:bg-white dark:md:bg-slate-900 text-slate-800 dark:text-slate-200 w-full h-full md:h-[88vh] md:max-w-5xl md:rounded-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row border border-white/10 md:border-slate-200 dark:md:border-slate-800 transition-colors duration-200">
        
        {/* Media Section (Left/Center) */}
        <div className="flex-1 bg-black flex items-center justify-center relative overflow-hidden min-h-[45vh] md:min-h-0">
          {data.type === "video" ? (
            <video
              src={data.url}
              controls
              autoPlay
              playsInline
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center overflow-auto p-2">
              <img
                src={data.url}
                alt={data.caption || "Medya"}
                referrerPolicy="no-referrer"
                style={{
                  transform: `scale(${zoomScale})`,
                  transition: "transform 0.15s ease-out",
                  transformOrigin: "center center",
                }}
                className="max-h-full max-w-full object-contain select-auto"
              />
            </div>
          )}

          {/* Media type badge */}
          <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white/90 text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 pointer-events-none">
            {data.type === "video" ? <Film size={13} /> : <ImageIcon size={13} />}
            <span className="capitalize">{data.type === "video" ? "Video" : "Fotoğraf"}</span>
          </div>

          {/* Zoom controls for photos */}
          {data.type !== "video" && (
            <div className="absolute bottom-3 left-3 bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 transition-colors">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoomScale <= 0.6}
                className="p-1 hover:text-blue-400 disabled:opacity-40 cursor-pointer"
                title="Küçült"
              >
                <ZoomOut size={16} />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="px-1 text-[11px] font-mono hover:text-blue-400 cursor-pointer"
                title="Sıfırla"
              >
                %{Math.round(zoomScale * 100)}
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoomScale >= 3.5}
                className="p-1 hover:text-blue-400 disabled:opacity-40 cursor-pointer"
                title="Büyüt"
              >
                <ZoomIn size={16} />
              </button>
            </div>
          )}

          {/* Quick download button on media */}
          <a
            href={data.url}
            download={data.fileName || `kapsapp-${Date.now()}`}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-3 right-3 bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors cursor-pointer"
            title="İndir"
          >
            <Download size={14} />
            <span>İndir</span>
          </a>
        </div>

        {/* Sidebar / Info Details (Instagram Style Right Panel) */}
        <div className="w-full md:w-[380px] lg:w-[420px] bg-white dark:bg-slate-900 flex flex-col h-full flex-shrink-0 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 transition-colors duration-200">
          
          {/* Header */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={data.authorId ? "cursor-pointer" : ""}
                onClick={() => {
                  if (data.authorId && onUserClick) {
                    onClose();
                    onUserClick(data.authorId);
                  }
                }}
              >
                <Avatar
                  url={data.authorAvatar}
                  name={data.authorName || "Kullanıcı"}
                  color={data.authorColor}
                  size={10}
                />
              </div>
              <div>
                <h3
                  className={`font-bold text-slate-800 dark:text-slate-100 text-[15px] leading-tight ${
                    data.authorId ? "cursor-pointer hover:underline" : ""
                  }`}
                  onClick={() => {
                    if (data.authorId && onUserClick) {
                      onClose();
                      onUserClick(data.authorId);
                    }
                  }}
                >
                  {data.authorName || "Kullanıcı"}
                </h3>
                {formattedDate && (
                  <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    <Calendar size={11} />
                    <span>{formattedDate}</span>
                  </div>
                )}
              </div>
            </div>

            <a
              href={data.url}
              download={data.fileName || `kapsapp-${Date.now()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              title="Medya İndir"
            >
              <Download size={18} />
            </a>
          </div>

          {/* Caption & Comments Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
            {/* Author Caption */}
            {data.caption && (
              <div className="flex items-start gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <Avatar
                  url={data.authorAvatar}
                  name={data.authorName}
                  color={data.authorColor}
                  size={8}
                />
                <div className="flex-1 text-slate-800 dark:text-slate-200">
                  <span className="font-bold mr-2">{data.authorName}</span>
                  <span className="leading-relaxed whitespace-pre-wrap">{data.caption}</span>
                </div>
              </div>
            )}

            {/* If Chat Message Details */}
            {data.fileName && (
              <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                <div className="font-semibold text-slate-700 dark:text-slate-300">Dosya Bilgisi:</div>
                <div className="truncate font-mono">{data.fileName}</div>
                {data.fileSize && <div>Boyut: {data.fileSize}</div>}
              </div>
            )}

            {/* Reactions if chat message */}
            {data.reactions && data.reactions.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tepkiler</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(
                    data.reactions.reduce((acc: any, r: any) => {
                      acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                      return acc;
                    }, {})
                  ).map(([emoji, count]: any) => (
                    <div
                      key={emoji}
                      className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-full px-2.5 py-1 text-slate-700 dark:text-slate-300 flex items-center gap-1 font-medium"
                    >
                      <span>{emoji}</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comments List (For Feed Posts) */}
            {data.comments && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Yorumlar ({data.comments.length})
                </div>
                {data.comments.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">
                    Henüz yorum yapılmamış. İlk yorumu sen bırak!
                  </p>
                ) : (
                  data.comments.map((c: any) => (
                    <div key={c.id} className="flex items-start gap-2.5">
                      <div
                        className="cursor-pointer"
                        onClick={() => {
                          if (c.user_id && onUserClick) {
                            onClose();
                            onUserClick(c.user_id);
                          }
                        }}
                      >
                        <Avatar
                          url={c.user_avatar || c.avatar}
                          name={c.username}
                          color={c.user_color || c.color}
                          size={7}
                        />
                      </div>
                      <div className="flex-1 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700">
                        <span
                          className="font-bold text-xs text-slate-800 dark:text-slate-200 mr-2 cursor-pointer hover:underline"
                          onClick={() => {
                            if (c.user_id && onUserClick) {
                              onClose();
                              onUserClick(c.user_id);
                            }
                          }}
                        >
                          {c.username}
                        </span>
                        <span className="text-xs text-slate-700 dark:text-slate-300 break-words leading-relaxed">
                          {c.content}
                        </span>
                        {c.created_at && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                            {new Date(c.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Action Bar (Likes & Comment Count for Feed) */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors duration-200">
            {data.onLike && (
              <div className="flex items-center gap-4 mb-3">
                <button
                  onClick={data.onLike}
                  className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                    data.isLiked ? "text-red-500" : "text-slate-600 dark:text-slate-400 hover:text-red-500"
                  }`}
                >
                  <Heart
                    size={22}
                    fill={data.isLiked ? "currentColor" : "none"}
                    className="transition-transform active:scale-125"
                  />
                  <span className="font-semibold text-sm">{data.likesCount || 0}</span>
                </button>

                {data.comments && (
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <MessageCircle size={20} />
                    <span className="font-semibold text-sm">{data.comments.length}</span>
                  </div>
                )}
              </div>
            )}

            {/* Comment Input */}
            {data.onAddComment && (
              <form onSubmit={handleAddComment} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Yorum ekle..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="flex-1 bg-slate-50 dark:bg-slate-800 rounded-full px-4 py-2 text-sm border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors"
                />
                <button
                  type="submit"
                  disabled={!commentText.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-full p-2 transition-colors cursor-pointer"
                >
                  <Send size={16} />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
