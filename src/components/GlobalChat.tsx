import React, { useState, useEffect, useRef } from "react";
import { Socket } from "socket.io-client";
import { Send, Image as ImageIcon, Mic, Reply, Smile, Paperclip, FileText, Download, Maximize2 } from "lucide-react";
import Avatar from "./Avatar";
import MediaModal from "./MediaModal";
import { MediaModalData } from "../types";

export default function GlobalChat({
  socket,
  currentUserId,
  onlineUsers,
  onUserClick,
}: {
  socket: Socket | null;
  currentUserId: number;
  onlineUsers: number[];
  onUserClick?: (id: number) => void;
}) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [users, setUsers] = useState<any[]>([]);

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [replyTo, setReplyTo] = useState<any>(null);
  const [typingUsers, setTypingUsers] = useState<number[]>([]);
  const [readReceipts, setReadReceipts] = useState<{ [userId: number]: number }>({});
  const [activeModalData, setActiveModalData] = useState<MediaModalData | null>(null);

  useEffect(() => {
    if (socket) {
      socket.emit("get_global_messages", (msgs: any[]) => setMessages(msgs));
      socket.emit("get_all_users", (allUsers: any[]) => setUsers(allUsers));
      socket.emit("get_global_read", (data: [number, number][]) =>
        setReadReceipts(Object.fromEntries(data))
      );

      const onNewMsg = (msg: any) => setMessages((prev) => [...prev, msg]);
      const onReacted = (data: any) => {
        if (data.type === "global") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === data.message_id ? { ...m, reactions: data.reactions } : m
            )
          );
        }
      };
      const onTyping = (data: any) => {
        if (data.type === "global") {
          setTypingUsers((prev) => {
            if (!prev.includes(data.sender)) return [...prev, data.sender];
            return prev;
          });
          setTimeout(() => {
            setTypingUsers((prev) => prev.filter((id) => id !== data.sender));
          }, 3000);
        }
      };
      const onReadUpdate = (data: [number, number][]) =>
        setReadReceipts(Object.fromEntries(data));

      socket.on("new_global_message", onNewMsg);
      socket.on("message_reacted", onReacted);
      socket.on("user_typing", onTyping);
      socket.on("global_read_update", onReadUpdate);

      return () => {
        socket.off("new_global_message", onNewMsg);
        socket.off("message_reacted", onReacted);
        socket.off("user_typing", onTyping);
        socket.off("global_read_update", onReadUpdate);
      };
    }
  }, [socket]);

  useEffect(() => {
    if (messages.length > 0 && socket) {
      socket.emit("mark_global_read", messages[messages.length - 1].id);
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, socket]);

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (socket) {
      socket.emit("typing", { type: "global" });
    }
  };

  const handleSend = () => {
    if (newMessage.trim() && socket) {
      socket.emit("send_global_message", {
        type: "text",
        content: newMessage.trim(),
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
    const file = e.target.files?.[0];
    if (file && socket) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
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

        const res = await fetch("/api/upload", { method: "POST", body: formData });
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

  const sortedUsers = [...users].sort((a, b) => {
    const aOnline = onlineUsers.includes(a.id);
    const bOnline = onlineUsers.includes(b.id);
    if (aOnline && !bOnline) return -1;
    if (!aOnline && bOnline) return 1;
    return a.username.localeCompare(b.username);
  });

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-50 relative">
      {/* Messages Feed */}
      <div className="flex-1 flex flex-col h-full bg-white shadow-sm border-r border-slate-200">
        <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between shadow-sm z-10">
          <div>
            <h1 className="font-bold text-slate-800 text-lg">Genel Sohbet</h1>
            <p className="text-xs text-slate-500">
              Herkesle anlık iletişim kur, fotoğraf, video ve dosya paylaş
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-xs font-semibold text-slate-600">
              {onlineUsers.length} Çevrimiçi
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, index) => {
            const isMine = msg.sender === currentUserId;
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
                className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
              >
                <div
                  className={`flex gap-2 max-w-[85%] md:max-w-[70%] group relative ${
                    isMine ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  <div
                    className={`relative rounded-2xl p-3.5 shadow-sm transition-all ${
                      isMine
                        ? "bg-blue-600 text-white rounded-br-none"
                        : "bg-slate-100 text-slate-800 rounded-bl-none"
                    }`}
                  >
                    {/* Floating Reaction & Reply buttons */}
                    <div
                      className={`absolute top-0 ${
                        isMine ? "-left-16" : "-right-16"
                      } hidden group-hover:flex gap-1 p-1 bg-white border border-slate-200 shadow-sm rounded-lg z-10 before:content-[''] before:absolute ${
                        isMine ? "before:-right-4" : "before:-left-4"
                      } before:top-0 before:w-4 before:h-full`}
                    >
                      <button
                        onClick={() => setReplyTo(msg)}
                        className="p-1 text-slate-400 hover:text-blue-500"
                        title="Yanıtla"
                      >
                        <Reply size={14} />
                      </button>
                      <button
                        onClick={() => handleReact(msg.id, "❤️")}
                        className="p-1 text-slate-400 hover:text-red-500"
                        title="Beğen"
                      >
                        <Smile size={14} />
                      </button>
                    </div>

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
                        <span className="text-xs font-semibold text-blue-600 hover:underline">
                          {msg.sender_name}
                        </span>
                      </div>
                    )}

                    {/* Reply Context */}
                    {msg.reply_message && (
                      <div
                        className={`mb-2 p-2 rounded-lg text-sm border-l-4 ${
                          isMine
                            ? "bg-blue-700/50 border-white text-white/90"
                            : "bg-slate-200 border-blue-500 text-slate-700"
                        }`}
                      >
                        <div className="font-semibold text-xs mb-1">
                          {msg.reply_message.sender_name}
                        </div>
                        {msg.reply_message.type === "text" ? (
                          <p className="truncate text-xs">{msg.reply_message.content}</p>
                        ) : (
                          <span className="italic text-xs">Medya</span>
                        )}
                      </div>
                    )}

                    {/* Text Message */}
                    {msg.type === "text" && (
                      <p className="break-words text-[15px] leading-relaxed">{msg.content}</p>
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
                      <div className="relative group overflow-hidden rounded-xl bg-black max-w-sm">
                        <video src={msg.content} controls playsInline className="w-full rounded-xl" />
                        <button
                          onClick={() => openMediaModal(msg)}
                          className="absolute top-2 right-2 bg-black/70 hover:bg-black text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          title="Büyüt ve Bilgileri Gör"
                        >
                          <Maximize2 size={14} />
                        </button>
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
                            : "bg-white hover:bg-slate-50 border-slate-200 text-slate-800"
                        }`}
                      >
                        <div
                          className={`p-2.5 rounded-lg shrink-0 ${
                            isMine ? "bg-white/20 text-white" : "bg-blue-100 text-blue-600"
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
                            isMine ? "hover:bg-white/10 text-white" : "hover:bg-slate-100 text-slate-500"
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
                                : "bg-white border-slate-200 text-slate-700"
                            }`}
                            onClick={() => handleReact(msg.id, emoji)}
                          >
                            {emoji} {count > 1 && count}
                          </div>
                        ))}
                      </div>
                    )}

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

        {/* Input Bar */}
        <div className="bg-white border-t border-slate-200 relative pb-safe">
          {replyTo && (
            <div className="absolute bottom-full left-0 w-full bg-slate-50 border-t border-slate-200 p-2 px-4 flex justify-between items-center text-sm shadow-md">
              <div>
                <span className="font-semibold text-blue-600">{replyTo.sender_name}</span> kişisine
                yanıtlanıyor:{" "}
                <span className="text-slate-500 truncate max-w-xs inline-block align-bottom">
                  {replyTo.type === "text" ? replyTo.content : "Medya"}
                </span>
              </div>
              <button
                onClick={() => setReplyTo(null)}
                className="text-slate-400 hover:text-red-500 font-bold px-2"
              >
                &times;
              </button>
            </div>
          )}

          <div className="p-3 flex items-center gap-2 max-w-4xl mx-auto">
            {/* Media Upload */}
            <label
              className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-full cursor-pointer transition-colors"
              title="Fotoğraf veya Video Gönder"
            >
              <input
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              <ImageIcon size={22} />
            </label>

            {/* Document / File Upload */}
            <label
              className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-full cursor-pointer transition-colors"
              title="Belge veya Dosya Gönder"
            >
              <input
                type="file"
                accept="*/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Paperclip size={22} />
            </label>

            <input
              type="text"
              placeholder="Mesaj yaz..."
              value={newMessage}
              onChange={handleTyping}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              className="flex-1 bg-slate-100 border-none rounded-full px-5 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-[15px]"
            />

            {newMessage.trim() ? (
              <button
                onClick={handleSend}
                className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-md cursor-pointer"
              >
                <Send size={20} />
              </button>
            ) : (
              <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                className={`p-3 rounded-full transition-all shadow-md cursor-pointer ${
                  isRecording
                    ? "bg-red-500 text-white scale-110 animate-pulse"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                <Mic size={20} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* User Sidebar */}
      <div className="hidden lg:flex flex-col w-64 bg-white border-l border-slate-200">
        <div className="p-4 border-b border-slate-200 bg-white shadow-sm z-10">
          <h2 className="font-bold text-slate-800">Kullanıcılar — {users.length}</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {sortedUsers.map((u) => {
            const isOnline = onlineUsers.includes(u.id);
            return (
              <div
                key={u.id}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => onUserClick && onUserClick(u.id)}
              >
                <div className="relative">
                  <Avatar url={u.avatar} name={u.username} color={u.color} size={10} />
                  {isOnline && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                  )}
                </div>
                <div className="flex-1 overflow-hidden">
                  <h4 className="font-semibold text-sm text-slate-800 truncate">{u.username}</h4>
                  <p className="text-xs text-slate-500 truncate">
                    {isOnline ? "Çevrimiçi" : "Çevrimdışı"}
                  </p>
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
