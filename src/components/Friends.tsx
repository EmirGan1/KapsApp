import { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import { User, Friend } from "../types";
import { Search, UserPlus, Check, Clock, UserRound } from "lucide-react";

export default function Friends({ socket, onlineUsers, currentUsername }: { socket: Socket | null, onlineUsers: number[], currentUsername: string }) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);

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
                      <span className="font-medium text-slate-700">{user.username}</span>
                    </div>
                    {isFriend ? (
                      <span className="text-xs font-medium text-slate-400 px-3 py-1 bg-slate-100 rounded-full">
                        {isFriend.status === 1 ? 'Arkadaş' : 'İstek Gönderildi'}
                      </span>
                    ) : (
                      <button onClick={() => handleAddFriend(user.id)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors">
                        <UserPlus size={20} />
                      </button>
                    )}
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
                  <div key={friend.id} className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                    <div className="relative">
                      {friend.avatar ? <img src={friend.avatar} className="w-12 h-12 rounded-full object-cover" /> : <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center"><UserRound size={24} className="text-slate-400" /></div>}
                      {isOnline && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">{friend.username}</h3>
                      <p className="text-xs text-slate-500">{isOnline ? "Çevrimiçi" : "Çevrimdışı"}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
