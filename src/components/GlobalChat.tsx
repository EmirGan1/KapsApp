import React, { useState, useEffect, useRef } from "react";
import { Socket } from "socket.io-client";
import { Send, Image as ImageIcon, Mic, Reply, Smile, Paperclip, FileText, Download, Maximize2, Trash2, Globe, Loader2 } from "lucide-react";
import Avatar from "./Avatar";
import MediaModal from "./MediaModal";
import { MediaModalData } from "../types";
import { 
  globalChatCache, 
  appendToGlobalCache, 
  updateGlobalCacheReactions, 
  removeFromGlobalCache, 
  clearGlobalCache 
} from "../utils/globalChatCache";
import { getApiUrl } from "../utils/api";
import { compressImage } from "../utils/imageCompressor";

export default function GlobalChat({
  socket,
  currentUserId,
  currentUsername,
  onlineUsers,
  onUserClick,
}: {
  socket: Socket | null;
  currentUserId: number;
  currentUsername?: string;
  onlineUsers: number[];
  onUserClick?: (id: number) => void;
}) {
  // Stale-While-Revalidate: Instant 0ms load from memory cache
  const [messages, setMessages] = useState<any[]>(() => [...globalChatCache.messages]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isInitialScrollDone = useRef(false);
  const [users, setUsers] = useState<any[]>(() => [...globalChatCache.users]);

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [replyTo, setReplyTo] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [typingUsers, setTypingUsers] = useState<number[]>([]);
  const typingTimersRef = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const lastTypingSentRef = useRef<number>(0);
  const stopTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [readReceipts, setReadReceipts] = useState<{ [userId: number]: number }>(() => ({ ...globalChatCache.readReceipts }));
  const [activeModalData, setActiveModalData] = useState<MediaModalData | null>(null);

  useEffect(() => {
    if (!socket) return;

    // Background fetch: If cache is empty, fetch initial batch; otherwise, fetch delta updates
    if (globalChatCache.messages.length === 0) {
      socket.emit("get_global_messages", (msgs: any[]) => {
        if (Array.isArray(msgs)) {
          globalChatCache.messages = msgs;
          globalChatCache.lastFetchedAt = new Date().toISOString();
          setMessages(msgs);
        }
      });
    } else {
      // Light background delta sync
      socket.emit("get_delta_global_messages", { since: globalChatCache.lastFetchedAt }, (deltaMsgs: any[]) => {
        if (Array.isArray(deltaMsgs) && deltaMsgs.length > 0) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const newItems = deltaMsgs.filter((m) => !existingIds.has(m.id));
            if (newItems.length === 0) return prev;
            const merged = [...prev, ...newItems];
            globalChatCache.messages = merged;
            return merged;
          });
        }
        globalChatCache.lastFetchedAt = new Date().toISOString();
      });
    }

    socket.emit("get_all_users", (allUsers: any[]) => {
      if (Array.isArray(allUsers)) {
        globalChatCache.users = allUsers;
        setUsers(allUsers);
      }
    });

    socket.emit("get_global_read", (data: [number, number][]) => {
      const parsed = Object.fromEntries(data);
      globalChatCache.readReceipts = parsed;
      setReadReceipts(parsed);
    });

    const onNewMsg = (msg: any) => {
      // Clear typing indicator for the message sender
      if (msg.sender) {
        const sId = Number(msg.sender);
        const existingTimer = typingTimersRef.current.get(sId);
        if (existingTimer) {
          clearTimeout(existingTimer);
          typingTimersRef.current.delete(sId);
        }
        setTypingUsers((prev) => prev.filter((id) => id !== sId));
      }

      appendToGlobalCache(msg);
      globalChatCache.lastFetchedAt = new Date().toISOString();
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    };

    const onReacted = (data: any) => {
      if (data.type === "global") {
        updateGlobalCacheReactions(data.message_id, data.reactions);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === data.message_id ? { ...m, reactions: data.reactions } : m
          )
        );
      }
    };
    
    const onMessageDeleted = (data: any) => {
      const deletedId = String(data?.message_id || data?.id || data?.messageId || data);
      removeFromGlobalCache(deletedId);
      setMessages((prev) => prev.filter(m => String(m.id) !== deletedId));
    };

    const onCleared = () => {
      clearGlobalCache();
      setMessages([]);
    };

    const onTyping = (data: any) => {
      if (data.type === "global") {
        const senderId = Number(data.sender);
        if (!senderId || senderId === currentUserId) return;

        // Reset existing timer if any (eliminates flickering)
        const existingTimer = typingTimersRef.current.get(senderId);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        setTypingUsers((prev) => {
          if (!prev.includes(senderId)) return [...prev, senderId];
          return prev;
        });

        // 3-second auto-clear timer
        const timer = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((id) => id !== senderId));
          typingTimersRef.current.delete(senderId);
        }, 3000);

        typingTimersRef.current.set(senderId, timer);
      }
    };

    const onStopTyping = (data: any) => {
      if (data.type === "global") {
        const senderId = Number(data.sender);
        if (!senderId) return;
        const existingTimer = typingTimersRef.current.get(senderId);
        if (existingTimer) {
          clearTimeout(existingTimer);
          typingTimersRef.current.delete(senderId);
        }
        setTypingUsers((prev) => prev.filter((id) => id !== senderId));
      }
    };

    const onReadUpdate = (data: [number, number][]) => {
      const parsed = Object.fromEntries(data);
      globalChatCache.readReceipts = parsed;
      setReadReceipts(parsed);
    };

    socket.on("new_global_message", onNewMsg);
    socket.on("message_reacted", onReacted);
    socket.on("message_deleted", onMessageDeleted);
    socket.on("message:deleted", onMessageDeleted);
    socket.on("global_chat_cleared", onCleared);
    socket.on("user_typing", onTyping);
    socket.on("user_stop_typing", onStopTyping);
    socket.on("global_read_update", onReadUpdate);

    return () => {
      socket.off("new_global_message", onNewMsg);
      socket.off("message_reacted", onReacted);
      socket.off("message_deleted", onMessageDeleted);
      socket.off("message:deleted", onMessageDeleted);
      socket.off("global_chat_cleared", onCleared);
      socket.off("user_typing", onTyping);
      socket.off("user_stop_typing", onStopTyping);
      socket.off("global_read_update", onReadUpdate);

      // Clean up all active typing timers
      typingTimersRef.current.forEach((t) => clearTimeout(t));
      typingTimersRef.current.clear();
      setTypingUsers([]);
    };
  }, [socket, currentUserId]);

  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    if (messages.length > 0) {
      if (!isInitialScrollDone.current) {
        // Immediate instant scroll to bottom on component mount/first messages load
        scrollToBottom("auto");
        isInitialScrollDone.current = true;
        // Re-check after frames and minor image rendering
        requestAnimationFrame(() => scrollToBottom("auto"));
        const timer = setTimeout(() => scrollToBottom("auto"), 80);
        return () => clearTimeout(timer);
      } else {
        // Smooth scroll for new incoming/outgoing messages
        scrollToBottom("smooth");
      }
    }
  }, [messages.length]);

  useEffect(() => {
    if (messages.length > 0 && socket) {
      socket.emit("mark_global_read", messages[messages.length - 1].id);
    }
  }, [messages, socket]);

  const emitStopTyping = () => {
    if (stopTypingTimeoutRef.current) {
      clearTimeout(stopTypingTimeoutRef.current);
      stopTypingTimeoutRef.current = null;
    }
    lastTypingSentRef.current = 0;
    if (socket) {
      socket.emit("stop_typing", { type: "global" });
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (!socket) return;

    const now = Date.now();
    // Throttled emit: Only emit when user starts typing or after 2.5 seconds
    if (now - lastTypingSentRef.current > 2500) {
      lastTypingSentRef.current = now;
      socket.emit("typing", { type: "global" });
    }

    // Debounce stop_typing after 3 seconds of typing inactivity
    if (stopTypingTimeoutRef.current) {
      clearTimeout(stopTypingTimeoutRef.current);
    }
    stopTypingTimeoutRef.current = setTimeout(() => {
      emitStopTyping();
    }, 3000);
  };

  const handleSend = () => {
    const trimmed = newMessage.trim();
    if (trimmed && socket) {
      if (trimmed.length > 1000) {
        alert("Mesajınız en fazla 1000 karakter olabilir.");
        return;
      }
      emitStopTyping();
      socket.emit("send_global_message", {
        type: "text",
        content: trimmed.slice(0, 1000),
        reply_to: replyTo?.id,
      });
      setNewMessage("");
      setReplyTo(null);
    }
  };

  const formatBytes = (bytes: number, decimals = 1) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (rawFile && socket) {
      setIsUploading(true);
      try {
        let fileToUpload = rawFile;
        if (rawFile.type.startsWith("image/")) {
          const compressed = await compressImage(rawFile, { maxWidth: 1920, maxHeight: 1080, quality: 0.85 });
          fileToUpload = compressed.file;
        }

        const formData = new FormData();
        formData.append("file", fileToUpload);
        const res = await fetch(getApiUrl("/api/upload"), { method: "POST", body: formData });
        const data = await res.json();
        if (data.url) {
          socket.emit("send_global_message", {
            type: data.media_type,
            content: data.url,
            file_name: data.original_name,
            file_size: formatBytes(data.size),
            reply_to: replyTo?.id,
          });
          setReplyTo(null);
        }
      } catch (err) {
        console.error("Upload error", err);
      } finally {
        setIsUploading(false);
        e.target.value = "";
      }
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("file", audioBlob, "audio.webm");

        const res = await fetch(getApiUrl("/api/upload"), { method: "POST", body: formData });
        const data = await res.json();
        if (data.url && socket) {
          socket.emit("send_global_message", {
            type: "audio",
            content: data.url,
            reply_to: replyTo?.id,
          });
          setReplyTo(null);
        }
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Audio recording error", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleReact = (messageId: number, emoji: string) => {
    if (socket) {
      socket.emit("react_message", { type: "global", message_id: messageId, emoji });
    }
  };

  const openMediaModal = (msg: any) => {
    const isMine = msg.sender === currentUserId;
    setActiveModalData({
      url: msg.content,
      type: msg.type === "video" ? "video" : "image",
      authorName: isMine ? "Sen" : msg.sender_name || "Kullanıcı",
      authorAvatar: msg.sender_avatar,
      authorColor: msg.sender_color,
      authorId: msg.sender,
      caption: msg.file_name || undefined,
      timestamp: msg.created_at,
    });
  };

  const handleDeleteMessage = (messageId: number) => {
    if (window.confirm("Bu mesajı silmek istediğinize emin misiniz?")) {
      const idStr = String(messageId);
      removeFromGlobalCache(idStr);
      setMessages((prev) => prev.filter((m) => String(m.id) !== idStr));
      if (socket) {
        socket.emit("delete_message", { message_id: messageId, id: messageId, type: "global" }, (res: any) => {
          if (res?.error) {
            alert(res.error);
            socket.emit("get_global_messages", setMessages);
          }
        });
      }
    }
  };

  const sortedUsers = [...users].sort((a, b) => {
    const aOnline = onlineUsers.includes(a.id);
    const bOnline = onlineUsers.includes(b.id);
    if (aOnline && !bOnline) return -1;
    if (!aOnline && bOnline) return 1;
    return a.username.localeCompare(b.username);
  });

  return (
    <div className="flex-1 flex overflow-hidden w-full max-w-full bg-slate-50 dark:bg-slate-950 relative transition-colors duration-200">
      {/* Messages Feed */}
      <div className="flex-1 flex flex-col h-full w-full min-w-0 max-w-full bg-white dark:bg-slate-950 shadow-sm border-r border-slate-200 dark:border-slate-800 transition-colors duration-200 overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shadow-sm z-10 shrink-0 transition-colors duration-200">
          <div className="min-w-0 pr-2">
            <h1 className="font-bold text-slate-800 dark:text-slate-100 text-base sm:text-lg truncate">Genel Sohbet</h1>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
              Herkesle anlık iletişim kur, medya ve dosya paylaş
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {currentUsername?.trim().toLowerCase() === 'emirgan' && (
              <button
                onClick={() => {
                  if (window.confirm("Genel sohbeti sıfırlamak istediğinize emin misiniz? Tüm mesajlar silinecektir.")) {
                    socket?.emit("clear_global_chat");
                  }
                }}
                className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 px-2 py-1 rounded-lg border border-red-200 dark:border-red-900/50 transition-colors font-medium whitespace-nowrap cursor-pointer"
                title="Genel Sohbeti Temizle (Yönetici)"
              >
                Sıfırla
              </button>
            )}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shrink-0"></span>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                {onlineUsers.length} <span className="hidden sm:inline">Çevrimiçi</span>
              </span>
            </div>
          </div>
        </div>

        <div ref={chatContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 space-y-3 sm:space-y-4 min-w-0 overscroll-contain">
          {messages.map((msg, index) => {
            const isMine = msg.sender === currentUserId;
            const isEmirgan = currentUsername?.trim().toLowerCase() === 'emirgan';
            const canDelete = isMine || isEmirgan;
            const isLast = index === messages.length - 1;

            const readers = Object.entries(readReceipts)
              .filter(
                ([uid, lastReadId]) =>
                  Number(uid) !== currentUserId &&
                  Number(uid) !== msg.sender &&
                  lastReadId >= msg.id
              )
              .map(([uid]) => users.find((u) => u.id === Number(uid)))
              .filter(Boolean);

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMine ? "items-end" : "items-start"} w-full min-w-0`}
              >
                <div
                  className={`flex items-center gap-1.5 sm:gap-2 max-w-[95%] sm:max-w-[85%] md:max-w-[75%] min-w-0 group relative ${
                    isMine ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  {/* Dedicated Delete (Çöp Kutusu) Button right beside message bubble */}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteMessage(msg.id);
                      }}
                      className="shrink-0 p-2 text-red-500 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-full transition-all cursor-pointer border border-red-200 dark:border-red-900/40 bg-white dark:bg-slate-900 shadow-sm self-center active:scale-95"
                      title={isEmirgan && !isMine ? "Yönetici Olarak Sil (emirgan)" : "Mesajı Sil"}
                    >
                      <Trash2 size={16} className="shrink-0" />
                    </button>
                  )}

                  <div
                    className={`relative rounded-2xl p-2.5 sm:p-3.5 shadow-sm transition-all min-w-0 max-w-full overflow-hidden [overflow-wrap:anywhere] break-words whitespace-normal select-text ${
                      isMine
                        ? "bg-blue-600 text-white rounded-br-none"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-none border border-slate-100 dark:border-slate-700"
                    }`}
                  >
                    {/* Replies / Quotes */}
                    {msg.reply_message && (
                      <div
                        className={`mb-2 p-2 rounded-lg text-sm border-l-4 min-w-0 max-w-full overflow-hidden ${
                          isMine
                            ? "bg-blue-700/50 border-white text-white/90"
                            : "bg-slate-200 dark:bg-slate-700/50 border-blue-500 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <div className="font-semibold text-xs mb-1 truncate">
                          {msg.reply_message.sender_name}
                        </div>
                        {msg.reply_message.type === "text" ? (
                          <p className="truncate text-xs">{msg.reply_message.content}</p>
                        ) : (
                          <span className="italic text-xs">Medya</span>
                        )}
                      </div>
                    )}

                    {/* Sender Name for incoming messages */}
                    {!isMine && (
                      <div
                        className="flex items-center gap-2 mb-1.5 cursor-pointer"
                        onClick={() => onUserClick && onUserClick(msg.sender)}
                      >
                        <Avatar
                          url={msg.sender_avatar}
                          name={msg.sender_name}
                          color={msg.sender_color}
                          size={5}
                        />
                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline truncate">
                          {msg.sender_name}
                        </span>
                      </div>
                    )}

                    {/* Text Message */}
                    {msg.type === "text" && (
                      <p className="break-words break-all [overflow-wrap:anywhere] whitespace-pre-wrap text-[15px] leading-relaxed select-text">
                        {msg.content}
                      </p>
                    )}

                    {/* Image Message */}
                    {msg.type === "image" && (
                      <div
                        className="relative group cursor-pointer overflow-hidden rounded-xl"
                        onClick={() => openMediaModal(msg)}
                      >
                        <img
                          src={msg.content}
                          alt="Fotoğraf"
                          referrerPolicy="no-referrer"
                          className="rounded-xl max-h-72 w-full object-cover hover:opacity-95 transition-opacity"
                        />
                        <button
                          className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Büyüt"
                        >
                          <Maximize2 size={14} />
                        </button>
                      </div>
                    )}

                    {/* Video Message */}
                    {msg.type === "video" && (
                      <div className="relative group overflow-hidden rounded-xl bg-black max-w-sm" onClick={() => openMediaModal(msg)}>
                        <video src={msg.content} autoPlay muted loop playsInline className="w-full rounded-xl pointer-events-none" />
                        <div
                          className="absolute top-2 right-2 bg-black/70 hover:bg-black text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center gap-1 cursor-pointer"
                          title="Büyüt ve Bilgileri Gör"
                        >
                          <Maximize2 size={14} />
                          <span className="text-xs pr-1 font-medium">Sesli İzle</span>
                        </div>
                      </div>
                    )}

                    {/* File Attachment */}
                    {msg.type === "file" && (
                      <a
                        href={msg.content}
                        download={msg.file_name || "dosya"}
                        target="_blank"
                        rel="noreferrer"
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                          isMine
                            ? "bg-blue-700/40 hover:bg-blue-700/60 border-blue-400 text-white"
                            : "bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                        }`}
                      >
                        <div
                          className={`p-2.5 rounded-lg shrink-0 ${
                            isMine ? "bg-white/20 text-white" : "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                          }`}
                        >
                          <FileText size={22} />
                        </div>
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="font-semibold text-sm truncate">
                            {msg.file_name || "Belge / Dosya"}
                          </p>
                          {msg.file_size && (
                            <p className="text-xs opacity-75">{msg.file_size}</p>
                          )}
                        </div>
                        <div
                          className={`p-1.5 rounded-full shrink-0 ${
                            isMine ? "hover:bg-white/10 text-white" : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          <Download size={18} />
                        </div>
                      </a>
                    )}

                    {/* Audio Message */}
                    {(msg.type === "audio" || msg.type === "voice") && (
                      <audio controls src={msg.content} className="max-w-[220px] h-10" />
                    )}

                    {/* Reactions */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className="flex gap-1 mt-1.5">
                        {Object.entries(
                          msg.reactions.reduce((acc: any, r: any) => {
                            acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                            return acc;
                          }, {})
                        ).map(([emoji, count]: any) => (
                          <div
                            key={emoji}
                            className={`border text-[11px] rounded-full px-1.5 py-0.5 shadow-sm cursor-pointer ${
                              isMine
                                ? "bg-blue-700 border-blue-500 text-white"
                                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                            }`}
                            onClick={() => handleReact(msg.id, emoji)}
                          >
                            {emoji} {count > 1 && count}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Action Bar (Always visible on all screens: mobile, tablet, desktop - No hover/hidden) */}
                    <div className={`flex items-center gap-1 mt-2 pt-1.5 border-t select-none ${
                      isMine ? "border-blue-500/40 justify-end" : "border-slate-200 dark:border-slate-700/60 justify-start"
                    }`}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReplyTo(msg);
                        }}
                        className={`px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                          isMine 
                            ? "text-blue-100 hover:text-white hover:bg-blue-700/60 active:bg-blue-800" 
                            : "text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/50 active:bg-slate-300"
                        }`}
                        title="Yanıtla"
                      >
                        <Reply size={13} className="shrink-0" />
                        <span>Yanıtla</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReact(msg.id, "❤️");
                        }}
                        className={`px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                          isMine 
                            ? "text-blue-100 hover:text-white hover:bg-blue-700/60 active:bg-blue-800" 
                            : "text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/50 active:bg-slate-300"
                        }`}
                        title="Beğen"
                      >
                        <Smile size={13} className="shrink-0" />
                        <span>❤️</span>
                      </button>

                      {canDelete && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteMessage(msg.id);
                          }}
                          className={`px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                            isMine 
                              ? "text-red-200 hover:text-white hover:bg-red-700/60 active:bg-red-800" 
                              : "text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 active:bg-red-100"
                          }`}
                          title={isEmirgan && !isMine ? "Yönetici Olarak Sil (emirgan)" : "Sil"}
                        >
                          <Trash2 size={13} className="shrink-0" />
                          <span>Sil</span>
                        </button>
                      )}
                    </div>

                    <div
                      className={`text-[10px] mt-1 text-right ${
                        isMine ? "text-blue-200" : "text-slate-400"
                      }`}
                    >
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>

                {isLast && readers.length > 0 && (
                  <div
                    className={`flex gap-1 mt-1 items-center px-1 ${
                      isMine ? "justify-end w-full" : ""
                    }`}
                  >
                    {readers.slice(0, 5).map((r: any) => (
                      <div
                        key={r.id}
                        title={r.username}
                        className="cursor-pointer"
                        onClick={() => onUserClick && onUserClick(r.id)}
                      >
                        <Avatar url={r.avatar} name={r.username} color={r.color} size={4} />
                      </div>
                    ))}
                    {readers.length > 5 && (
                      <span className="text-[10px] text-slate-400">+{readers.length - 5}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {typingUsers
            .filter((id) => id !== currentUserId)
            .map((id) => {
              const tUser = users.find((u) => u.id === id);
              if (!tUser) return null;
              return (
                <div key={`typing-${id}`} className="flex justify-start">
                  <div className="bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-bl-none shadow-sm p-3 flex items-center gap-2">
                    <span className="text-xs text-slate-500">{tUser.username} yazıyor</span>
                    <div className="flex gap-1">
                      <span
                        className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      />
                      <span
                        className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      />
                      <span
                        className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar - Sticky to bottom with safe-area padding for mobile virtual keyboards */}
        <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 relative pb-safe shrink-0 z-10">
          {replyTo && (
            <div className="absolute bottom-full left-0 w-full bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-2 px-3 sm:px-4 flex justify-between items-center text-xs sm:text-sm shadow-md">
              <div className="truncate pr-2">
                <span className="font-semibold text-blue-600 dark:text-blue-400">{replyTo.sender_name}</span> kişisine
                yanıtlanıyor:{" "}
                <span className="text-slate-500 dark:text-slate-400 truncate max-w-[150px] sm:max-w-xs inline-block align-bottom">
                  {replyTo.type === "text" ? replyTo.content : "Medya"}
                </span>
              </div>
              <button
                onClick={() => setReplyTo(null)}
                className="text-slate-400 hover:text-red-500 font-bold px-2 text-base shrink-0"
              >
                &times;
              </button>
            </div>
          )}

          <div className="p-2 sm:p-3 flex items-center gap-1.5 sm:gap-2 max-w-4xl mx-auto">
            {/* Media Upload */}
            <label
              className="p-2 sm:p-2.5 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-full cursor-pointer transition-colors shrink-0"
              title="Fotoğraf veya Video Gönder"
            >
              <input
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              <ImageIcon size={20} className="sm:w-[22px] sm:h-[22px]" />
            </label>

            {/* Document / File Upload */}
            <label
              className="p-2 sm:p-2.5 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-full cursor-pointer transition-colors shrink-0"
              title="Belge veya Dosya Gönder"
            >
              <input
                type="file"
                accept="*/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Paperclip size={20} className="sm:w-[22px] sm:h-[22px]" />
            </label>

            <div className="flex-1 flex items-center bg-slate-100 dark:bg-slate-800 rounded-full px-3 sm:px-4 py-1 sm:py-1.5 focus-within:ring-2 focus-within:ring-blue-500 min-w-0">
              {isUploading ? (
                <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 py-1 font-medium animate-pulse">
                  <Loader2 size={16} className="animate-spin" />
                  <span>Fotoğraf sıkıştırılıyor ve yükleniyor...</span>
                </div>
              ) : (
                <input
                  type="text"
                  placeholder="Mesaj yaz... (maks 1000)"
                  value={newMessage}
                  maxLength={1000}
                  onChange={handleTyping}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  className="flex-1 bg-transparent border-none focus:outline-none text-sm sm:text-[15px] py-1 text-slate-800 dark:text-slate-100 min-w-0"
                />
              )}
              {newMessage.length > 700 && (
                <span className="text-[10px] sm:text-[11px] text-slate-400 font-mono shrink-0 pl-1">
                  {1000 - newMessage.length}
                </span>
              )}
            </div>

            {newMessage.trim() ? (
              <button
                onClick={handleSend}
                className="p-2.5 sm:p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-md cursor-pointer shrink-0"
              >
                <Send size={18} className="sm:w-5 sm:h-5" />
              </button>
            ) : (
              <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                className={`p-2.5 sm:p-3 rounded-full transition-all shadow-md cursor-pointer shrink-0 ${
                  isRecording
                    ? "bg-red-500 text-white scale-110 animate-pulse"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                <Mic size={18} className="sm:w-5 sm:h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* User Sidebar */}
      <div className="hidden lg:flex flex-col w-64 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 transition-colors duration-200">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm z-10 transition-colors duration-200">
          <h2 className="font-bold text-slate-800 dark:text-slate-100">Kullanıcılar — {users.length}</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {sortedUsers.map((u) => {
            const isOnline = onlineUsers.includes(u.id);
            return (
              <div
                key={u.id}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                onClick={() => onUserClick && onUserClick(u.id)}
              >
                <div className="relative">
                  <Avatar url={u.avatar} name={u.username} color={u.color} size={10} />
                  {isOnline && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-slate-900 rounded-full transition-colors"></div>
                  )}
                </div>
                <div className="flex-1 overflow-hidden">
                  <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">{u.username}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {isOnline ? "Çevrimiçi" : "Çevrimdışı"}
                  </p>
                  {currentUsername?.trim().toLowerCase() === "emirgan" && (u.last_ip || u.signup_ip) && (
                    <div className="flex items-center gap-1 mt-0.5 text-[10px] font-mono text-slate-400 dark:text-slate-500">
                      <Globe size={10} className="text-blue-500 shrink-0" />
                      <span className="truncate">{u.last_ip || u.signup_ip}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Instagram-style Media Modal */}
      {activeModalData && (
        <MediaModal
          data={activeModalData}
          onClose={() => setActiveModalData(null)}
          onUserClick={onUserClick}
        />
      )}
    </div>
  );
}
