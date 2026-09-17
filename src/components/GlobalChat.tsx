import { useState, useEffect, useRef } from "react";
import { Socket } from "socket.io-client";
import { Send, Image as ImageIcon, Mic, Reply, Smile } from "lucide-react";
import Avatar from "./Avatar";

export default function GlobalChat({ socket, currentUserId, onlineUsers, onUserClick }: { socket: Socket | null, currentUserId: number, onlineUsers: number[], onUserClick?: (id: number) => void }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [users, setUsers] = useState<any[]>([]);
  
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [replyTo, setReplyTo] = useState<any>(null);
  const [typingUsers, setTypingUsers] = useState<number[]>([]);
  const [readReceipts, setReadReceipts] = useState<{[userId: number]: number}>({});
  
  let typingTimeoutRef = useRef<any>(null);

  useEffect(() => {
    if (socket) {
      socket.emit("get_global_messages", (msgs: any[]) => setMessages(msgs));
      socket.emit("get_all_users", (allUsers: any[]) => setUsers(allUsers));
      socket.emit("get_global_read", (data: [number, number][]) => setReadReceipts(Object.fromEntries(data)));
      
      const onNewMsg = (msg: any) => setMessages((prev) => [...prev, msg]);
      const onReacted = (data: any) => {
        if (data.type === 'global') {
          setMessages(prev => prev.map(m => m.id === data.message_id ? { ...m, reactions: data.reactions } : m));
        }
      };
      const onTyping = (data: any) => {
        if (data.type === 'global') {
          setTypingUsers(prev => {
            if (!prev.includes(data.sender)) return [...prev, data.sender];
            return prev;
          });
          setTimeout(() => {
            setTypingUsers(prev => prev.filter(id => id !== data.sender));
          }, 3000);
        }
      };
      const onReadUpdate = (data: [number, number][]) => setReadReceipts(Object.fromEntries(data));
      
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
      socket.emit("typing", { type: 'global' });
    }
  };

  const handleSend = () => {
    if (newMessage.trim() && socket) {
      socket.emit("send_global_message", { type: "text", content: newMessage, reply_to: replyTo?.id });
      setNewMessage("");
      setReplyTo(null);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && socket) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.url) {
          socket.emit("send_global_message", { type: "image", content: data.url, reply_to: replyTo?.id });
          setReplyTo(null);
        }
      } catch (err) {
        console.error("Upload error", err);
      } finally {
        e.target.value = '';
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
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append("file", audioBlob, "audio.webm");
        
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.url && socket) {
          socket.emit("send_global_message", { type: "audio", content: data.url, reply_to: replyTo?.id });
          setReplyTo(null);
        }
        stream.getTracks().forEach(track => track.stop());
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
      socket.emit("react_message", { type: 'global', message_id: messageId, emoji });
    }
  };

  const sortedUsers = [...users].sort((a, b) => {
    const aOn = onlineUsers.includes(a.id);
    const bOn = onlineUsers.includes(b.id);
    if (aOn && !bOn) return -1;
    if (!aOn && bOn) return 1;
    return a.username.localeCompare(b.username);
  });

  return (
    <div className="flex h-full bg-slate-50 relative overflow-hidden">
      
      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-4 border-b border-slate-200 bg-white shadow-sm z-10 flex items-center justify-between">
          <h2 className="font-bold text-lg text-slate-800">Genel Sohbet</h2>
          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{onlineUsers.length} Çevrimiçi</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => {
            const isMine = msg.sender === currentUserId;
            const isLast = idx === messages.length - 1;
            const readers = isLast ? Object.entries(readReceipts).filter(([uid, mid]) => Number(uid) !== currentUserId && mid === msg.id).map(([uid]) => users.find(u => u.id === Number(uid))).filter(Boolean) : [];
            return (
              <div key={msg.id || idx} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} mb-1`}>
                <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} group w-full relative`}>
                  <div className={`max-w-[75%] rounded-2xl p-3 relative ${isMine ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-sm'}`}>
                    
                    {/* Action Buttons (Reply/React) hidden by default, shown on hover */}
                    <div className={`absolute top-0 ${isMine ? '-left-16' : '-right-16'} hidden group-hover:flex gap-1 p-1 bg-white border border-slate-200 shadow-sm rounded-lg z-10 before:content-[''] before:absolute ${isMine ? 'before:-right-4' : 'before:-left-4'} before:top-0 before:w-4 before:h-full`}>
                      <button onClick={() => setReplyTo(msg)} className="p-1 text-slate-400 hover:text-blue-500"><Reply size={14}/></button>
                      <button onClick={() => handleReact(msg.id, '❤️')} className="p-1 text-slate-400 hover:text-red-500"><Smile size={14}/></button>
                    </div>

                    {!isMine && (
                      <div className="flex items-center gap-2 mb-1 cursor-pointer" onClick={() => onUserClick && onUserClick(msg.sender)}>
                        <Avatar url={msg.sender_avatar} name={msg.sender_name} color={msg.sender_color} size={5} />
                        <span className="text-xs font-semibold text-blue-600 hover:underline">{msg.sender_name}</span>
                      </div>
                    )}

                    {/* Reply Context */}
                    {msg.reply_message && (
                      <div className={`mb-2 p-2 rounded-lg text-sm border-l-4 ${isMine ? 'bg-blue-700/50 border-white text-white/90' : 'bg-slate-100 border-blue-500 text-slate-600'}`}>
                        <div className="font-semibold text-xs mb-1">{msg.reply_message.sender_name}</div>
                        {msg.reply_message.type === 'text' ? <p className="truncate">{msg.reply_message.content}</p> : <span className="italic">Medya</span>}
                      </div>
                    )}
                    
                    {msg.type === "text" && <p className="break-words text-[15px] leading-relaxed">{msg.content}</p>}
                    {msg.type === "image" && <img src={msg.content} alt="img" className="rounded-xl max-h-64 object-cover" />}
                    {msg.type === "audio" && (
                      <audio controls src={msg.content} className="max-w-[200px] h-10" />
                    )}
                    
                    {/* Reactions */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {Object.entries(msg.reactions.reduce((acc: any, r: any) => {
                           acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                           return acc;
                        }, {})).map(([emoji, count]: any) => (
                          <div key={emoji} className="bg-slate-100 border border-slate-200 text-xs rounded-full px-1.5 py-0.5 text-slate-700 shadow-sm cursor-pointer" onClick={() => handleReact(msg.id, emoji)}>
                            {emoji} {count > 1 && count}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className={`text-[10px] mt-1 text-right ${isMine ? 'text-blue-200' : 'text-slate-400'}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                  </div>
                </div>
                {isLast && readers.length > 0 && (
                  <div className="flex gap-1 mt-1 items-center px-1">
                    {readers.slice(0, 5).map((r: any) => (
                      <div key={r.id} title={r.username} className="cursor-pointer" onClick={() => onUserClick && onUserClick(r.id)}>
                        <Avatar url={r.avatar} name={r.username} color={r.color} size={4} />
                      </div>
                    ))}
                    {readers.length > 5 && <span className="text-[10px] text-slate-400">+{readers.length - 5}</span>}
                  </div>
                )}
              </div>
            );
          })}
          
          {typingUsers.filter(id => id !== currentUserId).map(id => {
            const tUser = users.find(u => u.id === id);
            if (!tUser) return null;
            return (
              <div key={`typing-${id}`} className="flex justify-start">
                <div className="bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-bl-none shadow-sm p-3 flex items-center gap-2">
                   <Avatar url={tUser.avatar} name={tUser.username} color={tUser.color} size={5} />
                   <div className="flex gap-1">
                     <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                     <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                     <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                   </div>
                </div>
              </div>
            );
          })}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-slate-200 pb-safe relative">
          {replyTo && (
            <div className="absolute bottom-full left-0 w-full bg-slate-50 border-t border-slate-200 p-2 px-4 flex justify-between items-center text-sm shadow-md">
               <div><span className="font-semibold text-blue-600">{replyTo.sender_name}</span> kişisine yanıtlanıyor: <span className="text-slate-500 truncate max-w-xs inline-block align-bottom">{replyTo.type === 'text' ? replyTo.content : 'Medya'}</span></div>
               <button onClick={() => setReplyTo(null)} className="text-slate-400 hover:text-red-500 font-bold px-2">&times;</button>
            </div>
          )}
          <div className="p-3 flex items-center gap-2 max-w-4xl mx-auto">
            <label className="p-3 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-full cursor-pointer transition-colors">
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              <ImageIcon size={22} />
            </label>
            <input 
              type="text" 
              placeholder="Mesaj yaz..." 
              value={newMessage}
              onChange={handleTyping}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className="flex-1 bg-slate-100 border-none rounded-full px-5 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-[15px]"
            />
            {newMessage.trim() ? (
              <button onClick={handleSend} className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-md">
                <Send size={20} />
              </button>
            ) : (
              <button 
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                className={`p-3 rounded-full transition-all shadow-md ${isRecording ? 'bg-red-500 text-white scale-110 animate-pulse' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
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
           {sortedUsers.map(u => {
             const isOnline = onlineUsers.includes(u.id);
             return (
               <div key={u.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => onUserClick && onUserClick(u.id)}>
                 <div className="relative">
                   <Avatar url={u.avatar} name={u.username} color={u.color} size={10} />
                   {isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>}
                 </div>
                 <div className="flex-1 overflow-hidden">
                   <h4 className="font-semibold text-sm text-slate-800 truncate">{u.username}</h4>
                   <p className="text-xs text-slate-500 truncate">{isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}</p>
                 </div>
               </div>
             )
           })}
        </div>
      </div>

    </div>
  );
}
