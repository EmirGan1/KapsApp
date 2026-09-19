import { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import { User, Friend } from "../types";
import { Search, UserPlus, Check, Clock, UserRound, UserX, AlertTriangle, Shield, Globe } from "lucide-react";

export default function Friends({ 
  socket, 
  onlineUsers, 
  currentUsername, 
  onUserClick 
}: { 
  socket: Socket | null, 
  onlineUsers: number[], 
  currentUsername: string,
  onUserClick?: (id: number) => void
}) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);

  // Admin delete modal
  const [userToDelete, setUserToDelete] = useState<{ id: number; username: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const isEmirgan = currentUsername?.trim().toLowerCase() === "emirgan";

  useEffect(() => {
    if (!socket) return;
    
    const loadFriends = () => {
      socket.emit("get_friends", (data: Friend[]) => setFriends(data));
    };

    loadFriends();
    socket.on("friends_updated", loadFriends);
    return () => { socket.off("friends_updated", loadFriends); };
  }, [socket]);

  useEffect(() => {
    if (!socket || !searchQuery) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      socket.emit("search_users", searchQuery, (results: User[]) => {
        setSearchResults(results.filter(r => r.username !== currentUsername));
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, socket, currentUsername]);

  const handleAddFriend = (id: number) => {
    socket?.emit("add_friend", id, () => {
      socket.emit("get_friends", (data: Friend[]) => setFriends(data));
      setSearchQuery("");
    });
  };

  const handleAccept = (id: number) => {
    socket?.emit("accept_friend", id, () => {
      socket.emit("get_friends", (data: Friend[]) => setFriends(data));
    });
  };

  const handleConfirmDeleteUser = () => {
    if (!userToDelete || !socket) return;
    setIsDeleting(true);
    socket.emit("admin_delete_user", { userId: userToDelete.id }, (res: any) => {
      setIsDeleting(false);
      if (res?.error) {
        alert(res.error);
      } else {
        alert("Kullanıcı başarıyla silindi.");
        setSearchResults(prev => prev.filter(u => u.id !== userToDelete.id));
        setFriends(prev => prev.filter(f => f.id !== userToDelete.id));
        setUserToDelete(null);
      }
    });
  };

  const pendingRequests = friends.filter(f => f.status === 0 && !f.is_sender);
  const sentRequests = friends.filter(f => f.status === 0 && f.is_sender);
  const acceptedFriends = friends.filter(f => f.status === 1);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-8">
        
        {/* Search */}
        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-4">Kişi Ara</h2>
          <div className="relative">
            <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Kullanıcı adı yazın..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            />
          </div>
          
          {searchResults.length > 0 && (
            <div className="mt-4 bg-white rounded-xl shadow-sm border border-slate-100 divide-y divide-slate-100 overflow-hidden">
              {searchResults.map(user => {
                const isFriend = friends.find(f => f.id === user.id);
                return (
                  <div key={user.id} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      {user.avatar ? <img src={user.avatar} className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center"><UserRound size={20} className="text-slate-400" /></div>}
                      <div>
                        <span className="font-medium text-slate-700">{user.username}</span>
                        {isEmirgan && (user.last_ip || user.signup_ip) && (
                          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] font-mono text-slate-500">
                            <Globe size={11} className="text-blue-500 shrink-0" />
                            <span>IP: {user.last_ip || user.signup_ip}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isFriend ? (
                        <span className="text-xs font-medium text-slate-400 px-3 py-1 bg-slate-100 rounded-full">
                          {isFriend.status === 1 ? 'Arkadaş' : 'İstek Gönderildi'}
                        </span>
                      ) : (
                        <button onClick={() => handleAddFriend(user.id)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors">
                          <UserPlus size={20} />
                        </button>
                      )}
                      {isEmirgan && (
                        <button
                          onClick={() => setUserToDelete({ id: user.id, username: user.username })}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors cursor-pointer"
                          title="Kullanıcıyı Sil / Banla (Yönetici)"
                        >
                          <UserX size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Requests */}
        {pendingRequests.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-slate-800 mb-4">Gelen İstekler</h2>
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 divide-y divide-slate-100">
              {pendingRequests.map(req => (
                <div key={req.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    {req.avatar ? <img src={req.avatar} className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center"><UserRound size={20} className="text-slate-400" /></div>}
                    <span className="font-medium text-slate-700">{req.username}</span>
                  </div>
                  <button onClick={() => handleAccept(req.id)} className="flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm shadow-blue-500/20">
                    <Check size={16} /> Kabul Et
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Friends */}
        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-4">Arkadaşların ({acceptedFriends.length})</h2>
          {acceptedFriends.length === 0 ? (
            <div className="text-center p-8 bg-white rounded-xl border border-dashed border-slate-200">
              <p className="text-slate-500">Henüz arkadaş eklemedin.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {acceptedFriends.map(friend => {
                const isOnline = onlineUsers.includes(friend.id);
                return (
                  <div key={friend.id} className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-100 hover:border-slate-300 transition-all">
                    <div className="flex items-center gap-4 cursor-pointer flex-1 min-w-0" onClick={() => onUserClick && onUserClick(friend.id)}>
                      <div className="relative shrink-0">
                        {friend.avatar ? <img src={friend.avatar} className="w-12 h-12 rounded-full object-cover" /> : <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center"><UserRound size={24} className="text-slate-400" /></div>}
                        {isOnline && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>}
                      </div>
                      <div className="truncate">
                        <h3 className="font-semibold text-slate-800 hover:text-blue-600 transition-colors truncate">{friend.username}</h3>
                        <p className="text-xs text-slate-500">{isOnline ? "Çevrimiçi" : "Çevrimdışı"}</p>
                        {isEmirgan && (friend.last_ip || friend.signup_ip) && (
                          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] font-mono text-slate-500">
                            <Globe size={11} className="text-blue-500 shrink-0" />
                            <span className="truncate">IP: {friend.last_ip || friend.signup_ip}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {isEmirgan && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setUserToDelete({ id: friend.id, username: friend.username });
                        }}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors cursor-pointer shrink-0 ml-2"
                        title="Kullanıcıyı Sil / Banla (Yönetici)"
                      >
                        <UserX size={18} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>

      {/* Admin Delete User Modal in Friends */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-3 bg-red-100 rounded-xl shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Kullanıcıyı Sil / Banla</h3>
                <p className="text-xs text-slate-500">Yönetici Yetkisi (emirgan)</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              <strong className="text-slate-900 font-bold">"{userToDelete.username}"</strong> adlı kullanıcının hesabını ve tüm verilerini kalıcı olarak silmek üzeresiniz. Bu işlem geri alınamaz!
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setUserToDelete(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDeleteUser}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold transition-colors cursor-pointer shadow-md shadow-red-600/20"
              >
                {isDeleting ? "Siliniyor..." : "Evet, Kalıcı Olarak Sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
