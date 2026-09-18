import { useState, useEffect, useRef } from "react";
import { Socket } from "socket.io-client";
import { Friend, Message, MediaModalData } from "../types";
import { Send, Image as ImageIcon, Mic, Users, Plus, X, Reply, Smile, FileText, Download, Paperclip, Maximize2 } from "lucide-react";
import Avatar from "./Avatar";
import MediaModal from "./MediaModal";

type Group = {
  id: number;
  name: string;
  creator: number;
  members: number[];
  created_at: string;
};

export default function Chats({ socket, currentUserId, onlineUsers, onUserClick }: { socket: Socket | null, currentUserId: number, onlineUsers: number[], onUserClick?: (id: number) => void }) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeTab, setActiveTab] = useState<"friends" | "groups">("friends");
  const [activeChat, setActiveChat] = useState<Friend | Group | null>(null);
  
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<number[]>([]);

  const [replyTo, setReplyTo] = useState<any>(null);
  const [typingUsers, setTypingUsers] = useState<number[]>([]);
  const [readReceipts, setReadReceipts] = useState<{[userId: number]: number}>({});
  const [users, setUsers] = useState<any[]>([]);

  const [activeModalData, setActiveModalData] = useState<MediaModalData | null>(null);

  useEffect(() => {
    if (!socket) return;
    const loadFriends = () => socket.emit("get_friends", (data: Friend[]) => setFriends(data.filter(f => f.status === 1)));
    const loadGroups = () => socket.emit("get_groups", (data: Group[]) => setGroups(data));
    socket.emit("get_all_users", (allUsers: any[]) => setUsers(allUsers));
    
    loadFriends();
    loadGroups();
    
    socket.on("friends_updated", loadFriends);
    socket.on("groups_updated", loadGroups);
    
    return () => { 
      socket.off("friends_updated", loadFriends); 
      socket.off("groups_updated", loadGroups);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket || !activeChat) return;
    
    const roomId = activeTab === "friends" ? `dm_${Math.min(currentUserId, activeChat.id)}_${Math.max(currentUserId, activeChat.id)}` : `group_${activeChat.id}`;
    
    if (activeTab === "friends") {
      socket.emit("get_messages", activeChat.id, setMessages);
    } else {
      socket.emit("get_group_messages", activeChat.id, setMessages);
    }

    socket.emit("get_chat_read", roomId, (data: [number, number][]) => setReadReceipts(Object.fromEntries(data)));
    
    const handleNewMsg = (msg: any) => {
      if (activeTab === "friends") {
        if ((msg.sender === activeChat.id && msg.receiver === currentUserId) || 
            (msg.sender === currentUserId && msg.receiver === activeChat.id)) {
          setMessages(prev => [...prev, msg]);
        }
      } else {
        if (msg.group_id === activeChat.id) {
          setMessages(prev => [...prev, msg]);
        }
      }
    };

    const onReacted = (data: any) => {
      if ((activeTab === "friends" && data.type === "private") || (activeTab === "groups" && data.type === "group")) {
        setMessages(prev => prev.map(m => m.id === data.message_id ? { ...m, reactions: data.reactions } : m));
      }
    };

    const onTyping = (data: any) => {
      if ((activeTab === "friends" && data.type === "private" && data.sender === activeChat.id) || 
          (activeTab === "groups" && data.type === "group" && data.group_id === activeChat.id)) {
        setTypingUsers(prev => {
          if (!prev.includes(data.sender)) return [...prev, data.sender];
          return prev;
        });
        setTimeout(() => {
          setTypingUsers(prev => prev.filter(id => id !== data.sender));
        }, 3000);
      }
    };

    const handleReadUpdate = (rId: string, data: [number, number][]) => {
      if (rId === roomId) {
        setReadReceipts(Object.fromEntries(data));
      }
    };
    
    socket.on(activeTab === "friends" ? "new_message" : "new_group_message", handleNewMsg);
    socket.on("message_reacted", onReacted);
    socket.on("user_typing", onTyping);
    socket.on("chat_read_update", handleReadUpdate);
    return () => { 
      socket.off(activeTab === "friends" ? "new_message" : "new_group_message", handleNewMsg); 
      socket.off("message_reacted", onReacted);
      socket.off("user_typing", onTyping);
      socket.off("chat_read_update", handleReadUpdate);
    };
  }, [socket, activeChat, currentUserId, activeTab]);

  useEffect(() => {
    if (messages.length > 0 && socket && activeChat) {
      const roomId = activeTab === "friends" ? `dm_${Math.min(currentUserId, activeChat.id)}_${Math.max(currentUserId, activeChat.id)}` : `group_${activeChat.id}`;
      socket.emit("mark_chat_read", roomId, messages[messages.length - 1].id);
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, socket, activeChat, activeTab, currentUserId]);

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    if (socket && activeChat) {
      if (activeTab === "friends") {
        socket.emit("typing", { type: 'private', receiver: activeChat.id });
      } else {
        socket.emit("typing", { type: 'group', group_id: activeChat.id });
      }
    }
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !activeChat || !socket) return;
    
    if (activeTab === "friends") {
      socket.emit("send_message", { receiver: activeChat.id, type: "text", content: text.trim(), reply_to: replyTo?.id });
    } else {
      socket.emit("send_group_message", { group_id: activeChat.id, type: "text", content: text.trim(), reply_to: replyTo?.id });
    }
    setText("");
    setReplyTo(null);
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
    if (!file || !activeChat || !socket) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        const payload = {
          type: data.media_type,
          content: data.url,
          file_name: data.original_name,
          file_size: formatBytes(data.size),
          reply_to: replyTo?.id
        };
        if (activeTab === "friends") {
          socket.emit("send_message", { receiver: activeChat.id, ...payload });
        } else {
          socket.emit("send_group_message", { group_id: activeChat.id, ...payload });
        }
        setReplyTo(null);
      }
    } catch (err) { 
      console.error("File upload error:", err); 
    } finally {
      e.target.value = '';
    }
  };

  const openMediaModal = (msg: any) => {
    const isMine = msg.sender === currentUserId;
    let senderName = msg.sender_name;
    let senderAvatar = msg.sender_avatar;
    let senderColor = msg.sender_color;
    if (isMine) {
      senderName = "Sen";
    } else if (activeTab === "friends") {
      senderName = (activeChat as Friend).username;
      senderAvatar = (activeChat as Friend).avatar;
      senderColor = (activeChat as Friend).color;
    }
    setActiveModalData({
      url: msg.content,
      type: msg.type === "video" ? "video" : "image",
      authorName: senderName || "Kullanıcı",
      authorAvatar: senderAvatar,
      authorColor: senderColor,
      authorId: msg.sender,
      caption: msg.file_name || undefined,
      timestamp: msg.created_at,
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorder.current = recorder;
      audioChunks.current = [];
      
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.current.push(e.data); };
      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append("file", audioBlob, "voice.webm");
        try {
          const res = await fetch("/api/upload", { method: "POST", body: formData });
          const data = await res.json();
          if (res.ok && socket && activeChat) {
            if (activeTab === "friends") {
              socket.emit("send_message", { receiver: activeChat.id, type: "voice", content: data.url, reply_to: replyTo?.id });
            } else {
              socket.emit("send_group_message", { group_id: activeChat.id, type: "voice", content: data.url, reply_to: replyTo?.id });
            }
            setReplyTo(null);
          }
        } catch (err) { console.error(err); }
      };
      
      recorder.start();
      setIsRecording(true);
    } catch (err) { console.error("Mic access denied"); }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach(t => t.stop());
      setIsRecording(false);
    }
  };

  const handleReact = (messageId: number, emoji: string) => {
    if (socket) {
      socket.emit("react_message", { type: activeTab === "friends" ? 'private' : 'group', message_id: messageId, emoji });
    }
  };

  const handleCreateGroup = () => {
    if (!newGroupName.trim() || selectedFriends.length === 0 || !socket) return;
    socket.emit("create_group", { name: newGroupName.trim(), members: selectedFriends }, (group: Group) => {
      setShowCreateGroup(false);
      setNewGroupName("");
      setSelectedFriends([]);
      setActiveTab("groups");
      setActiveChat(group);
    });
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-white">
      {/* Sidebar */}
      <div className={`w-full md:w-80 border-r border-slate-100 flex flex-col bg-slate-50 ${activeChat ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-slate-200 bg-white shadow-sm z-10 flex flex-col gap-3">
          <h2 className="text-xl font-bold text-slate-800">Sohbetler</h2>
          
          <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
            <button 
              onClick={() => { setActiveTab("friends"); setActiveChat(null); }} 
              className={`flex-1 py-1 text-sm font-medium rounded-md ${activeTab === 'friends' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Kişiler
            </button>
            <button 
              onClick={() => { setActiveTab("groups"); setActiveChat(null); }} 
              className={`flex-1 py-1 text-sm font-medium rounded-md ${activeTab === 'groups' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Gruplar
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 relative">
          {activeTab === "friends" ? (
            friends.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-sm">Arkadaş ekleyerek sohbete başlayın.</div>
            ) : (
              friends.map(f => {
                const isOnline = onlineUsers.includes(f.id);
                return (
                  <button 
                    key={f.id} 
                    onClick={() => setActiveChat(f)}
                    className={`w-full flex items-center gap-3 p-4 hover:bg-slate-100 transition-colors ${activeChat?.id === f.id ? 'bg-blue-50/50' : ''}`}
                  >
                    <div className="relative flex-shrink-0">
                      <Avatar url={f.avatar} name={f.username} color={f.color} size={12} />
                      {isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>}
                    </div>
                    <div className="text-left overflow-hidden flex-1">
                      <h3 className="font-semibold text-slate-800 truncate">{f.username}</h3>
                      <p className="text-xs text-slate-500 truncate">{isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}</p>
                    </div>
                  </button>
                )
              })
            )
          ) : (
            <>
              {groups.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-sm">Henüz hiçbir gruba katılmadınız.</div>
              ) : (
                groups.map(g => (
                  <button 
                    key={g.id} 
                    onClick={() => setActiveChat(g)}
                    className={`w-full flex items-center gap-3 p-4 hover:bg-slate-100 transition-colors ${activeChat?.id === g.id ? 'bg-blue-50/50' : ''}`}
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600"><Users size={24} /></div>
                    </div>
                    <div className="text-left overflow-hidden flex-1">
                      <h3 className="font-semibold text-slate-800 truncate">{g.name}</h3>
                      <p className="text-xs text-slate-500 truncate">{g.members.length} Üye</p>
                    </div>
                  </button>
                ))
              )}
            </>
          )}
          
          {activeTab === "groups" && (
            <button 
              onClick={() => setShowCreateGroup(true)}
              className="absolute bottom-6 right-6 w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 transition-colors"
            >
              <Plus size={24} />
            </button>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col bg-[#F0F2F5] relative ${!activeChat ? 'hidden md:flex' : 'flex'}`}>
        {!activeChat ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 flex-col gap-4">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
              <Send size={32} className="text-slate-300 ml-1" />
            </div>
            <p>Sohbet etmek için bir {activeTab === "friends" ? "arkadaş" : "grup"} seçin</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="bg-white px-6 py-3 border-b border-slate-200 flex items-center gap-3 shadow-sm z-10">
              <button className="md:hidden p-2 -ml-2 text-blue-600" onClick={() => setActiveChat(null)}>Geri</button>
              
              {activeTab === "friends" ? (
                <div className="relative">
                  <Avatar url={(activeChat as Friend).avatar} name={(activeChat as Friend).username} color={(activeChat as Friend).color} size={10} />
                  {onlineUsers.includes(activeChat.id) && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>}
                </div>
              ) : (
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center"><Users size={20} /></div>
              )}
              
              <div>
                <h3 className="font-bold text-slate-800 leading-tight">{(activeChat as Friend).username || (activeChat as Group).name}</h3>
                {activeTab === "friends" ? (
                  <span className="text-xs text-slate-500">{onlineUsers.includes(activeChat.id) ? 'Çevrimiçi' : 'Çevrimdışı'}</span>
                ) : (
                  <span className="text-xs text-slate-500">{(activeChat as Group).members.length} Üye</span>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, idx) => {
                const isMine = msg.sender === currentUserId;
                const isLast = idx === messages.length - 1;
                const readers = isLast ? Object.entries(readReceipts).filter(([uid, mid]) => Number(uid) !== currentUserId && mid === msg.id).map(([uid]) => users.find(u => u.id === Number(uid))).filter(Boolean) : [];
                return (
                  <div key={msg.id || idx} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} mb-1`}>
                    <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} group w-full relative`}>
                      <div className={`max-w-[75%] rounded-2xl p-2 px-3 shadow-sm relative ${isMine ? 'bg-[#DCF8C6] rounded-tr-none' : 'bg-white rounded-tl-none border border-slate-100'}`}>
                        
                        {/* Action Buttons (Reply/React) hidden by default, shown on hover */}
                        <div className={`absolute top-0 ${isMine ? '-left-16' : '-right-16'} hidden group-hover:flex gap-1 p-1 bg-white border border-slate-200 shadow-sm rounded-lg z-10 before:content-[''] before:absolute ${isMine ? 'before:-right-4' : 'before:-left-4'} before:top-0 before:w-4 before:h-full`}>
                          <button onClick={() => setReplyTo(msg)} className="p-1 text-slate-400 hover:text-blue-500"><Reply size={14}/></button>
                          <button onClick={() => handleReact(msg.id, '❤️')} className="p-1 text-slate-400 hover:text-red-500"><Smile size={14}/></button>
                        </div>

                        {activeTab === "groups" && !isMine && (
                          <div className="flex items-center gap-2 mb-1 cursor-pointer" onClick={() => onUserClick && onUserClick(msg.sender)}>
                            <Avatar url={msg.sender_avatar} name={msg.sender_name} color={msg.sender_color} size={4} />
                            <span className="text-[11px] font-semibold text-blue-600 hover:underline">{msg.sender_name}</span>
                          </div>
                        )}
                        
                        {/* Reply Context */}
                        {msg.reply_message && (
                          <div className={`mb-2 p-2 rounded-lg text-sm border-l-4 ${isMine ? 'bg-green-700/20 border-green-600 text-green-900' : 'bg-slate-100 border-blue-500 text-slate-600'}`}>
                            <div className="font-semibold text-xs mb-1">{msg.reply_message.sender_name}</div>
                            {msg.reply_message.type === 'text' ? <p className="truncate text-xs">{msg.reply_message.content}</p> : <span className="italic text-xs">Medya</span>}
                          </div>
                        )}

                        {msg.type === 'text' && <p className="text-[15px] text-slate-800 leading-relaxed break-words">{msg.content}</p>}
                        {msg.type === 'image' && (
                          <div className="relative group cursor-pointer overflow-hidden rounded-xl max-w-xs md:max-w-sm" onClick={() => openMediaModal(msg)}>
                            <img src={msg.content} referrerPolicy="no-referrer" alt="Fotoğraf" className="w-full object-cover rounded-xl hover:opacity-95 transition-opacity" />
                            <button className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                              <Maximize2 size={14} />
                            </button>
                          </div>
                        )}
                        {msg.type === 'video' && (
                          <div className="relative group overflow-hidden rounded-xl max-w-xs md:max-w-sm bg-black">
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
                        {msg.type === 'file' && (
                          <a 
                            href={msg.content} 
                            download={msg.file_name || "dosya"} 
                            target="_blank" 
                            rel="noreferrer"
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                              isMine 
                                ? 'bg-green-700/10 hover:bg-green-700/20 border-green-300 text-green-950' 
                                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                            }`}
                          >
                            <div className="p-2.5 bg-blue-100 text-blue-600 rounded-lg shrink-0">
                              <FileText size={22} />
                            </div>
                            <div className="flex-1 min-w-0 pr-2">
                              <p className="font-semibold text-sm truncate">{msg.file_name || "Belge / Dosya"}</p>
                              {msg.file_size && <p className="text-xs opacity-70">{msg.file_size}</p>}
                            </div>
                            <div className="p-1.5 rounded-full hover:bg-black/5 text-slate-500 shrink-0">
                              <Download size={18} />
                            </div>
                          </a>
                        )}
                        {msg.type === 'voice' && <audio src={msg.content} controls className="h-10 max-w-[200px]" />}
                        
                        {/* Reactions */}
                        {msg.reactions && msg.reactions.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {Object.entries(msg.reactions.reduce((acc: any, r: any) => {
                               acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                               return acc;
                            }, {})).map(([emoji, count]: any) => (
                              <div key={emoji} className={`border text-[10px] rounded-full px-1.5 py-0.5 shadow-sm cursor-pointer ${isMine ? 'bg-[#DCF8C6] border-green-300 text-green-800' : 'bg-slate-50 border-slate-200 text-slate-700'}`} onClick={() => handleReact(msg.id, emoji)}>
                                {emoji} {count > 1 && count}
                              </div>
                            ))}
                          </div>
                        )}

                        <div className={`text-[10px] mt-1 text-right ${isMine ? 'text-green-700/60' : 'text-slate-400'}`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                    {isLast && readers.length > 0 && (
                      <div className={`flex gap-1 mt-1 items-center px-1 ${isMine ? 'justify-end w-full' : ''}`}>
                        {readers.slice(0, 5).map((r: any) => (
                          <div key={r.id} title={r.username} className="cursor-pointer" onClick={() => onUserClick && onUserClick(r.id)}>
                            <Avatar url={r.avatar} name={r.username} color={r.color} size={3.5} />
                          </div>
                        ))}
                        {readers.length > 5 && <span className="text-[10px] text-slate-400">+{readers.length - 5}</span>}
                      </div>
                    )}
                  </div>
                )
              })}
              
              {typingUsers.filter(id => id !== currentUserId).map(id => {
                let name = "Biri";
                if (activeTab === "friends") name = (activeChat as Friend).username;
                else {
                  const fm = friends.find(f => f.id === id);
                  if (fm) name = fm.username;
                }
                return (
                  <div key={`typing-${id}`} className="flex justify-start">
                    <div className="bg-white border border-slate-200 text-slate-500 rounded-2xl rounded-bl-none shadow-sm p-3 flex items-center gap-2 text-xs font-medium">
                       <span>{name} yazıyor</span>
                       <div className="flex gap-1 ml-1">
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

            {/* Input */}
            <div className="bg-[#f0f2f5] border-t border-slate-200 relative pb-safe">
              {replyTo && (
                <div className="absolute bottom-full left-0 w-full bg-slate-50 border-t border-slate-200 p-2 px-4 flex justify-between items-center text-sm shadow-md">
                   <div><span className="font-semibold text-blue-600">{replyTo.sender_name || (activeTab === 'friends' ? (activeChat as Friend).username : 'Biri')}</span> kişisine yanıtlanıyor: <span className="text-slate-500 truncate max-w-xs inline-block align-bottom">{replyTo.type === 'text' ? replyTo.content : 'Medya'}</span></div>
                   <button onClick={() => setReplyTo(null)} className="text-slate-400 hover:text-red-500 font-bold px-2">&times;</button>
                </div>
              )}
              <div className="p-3 flex items-center gap-1">
                <label className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-slate-200/70 rounded-full cursor-pointer transition-colors" title="Fotoğraf veya Video Gönder">
                  <ImageIcon size={22} />
                  <input type="file" accept="image/*,video/*" className="hidden" onChange={handleFileUpload} />
                </label>
                <label className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-slate-200/70 rounded-full cursor-pointer transition-colors" title="Belge / Dosya Gönder">
                  <Paperclip size={22} />
                  <input type="file" accept="*/*" className="hidden" onChange={handleFileUpload} />
                </label>
                <form onSubmit={handleSendText} className="flex-1 relative">
                  <input 
                    type="text" 
                    placeholder="Bir mesaj yazın..." 
                    className="w-full bg-white border-transparent focus:ring-0 focus:outline-none py-3 px-4 rounded-xl shadow-sm text-[15px]"
                    value={text}
                    onChange={handleTyping}
                  />
                </form>
                {text.trim() ? (
                  <button onClick={handleSendText} className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors shadow-md">
                    <Send size={20} />
                  </button>
                ) : (
                  <button 
                    onMouseDown={startRecording} 
                    onMouseUp={stopRecording}
                    onMouseLeave={stopRecording}
                    onTouchStart={startRecording}
                    onTouchEnd={stopRecording}
                    className={`p-3 rounded-full transition-colors shadow-md ${isRecording ? 'bg-red-500 text-white animate-pulse scale-110' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                  >
                    <Mic size={20} />
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Create Group Modal */}
      {showCreateGroup && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-800">Yeni Grup Oluştur</h3>
              <button onClick={() => setShowCreateGroup(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 border-b border-slate-100">
              <input 
                type="text" 
                placeholder="Grup Adı" 
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto">
              <h4 className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">Üye Seçimi</h4>
              <div className="space-y-2">
                {friends.length === 0 ? (
                  <p className="text-sm text-slate-500">Grup kuracak arkadaşınız yok.</p>
                ) : (
                  friends.map(f => (
                    <label key={f.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={selectedFriends.includes(f.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedFriends([...selectedFriends, f.id]);
                          else setSelectedFriends(selectedFriends.filter(id => id !== f.id));
                        }}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <Avatar url={f.avatar} name={f.username} color={f.color} size={8} />
                      <span className="text-sm font-medium text-slate-700">{f.username}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50">
              <button 
                onClick={handleCreateGroup}
                disabled={!newGroupName.trim() || selectedFriends.length === 0}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-colors shadow-sm"
              >
                Grubu Oluştur ({selectedFriends.length} Kişi)
              </button>
            </div>
          </div>
        </div>
      )}
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
