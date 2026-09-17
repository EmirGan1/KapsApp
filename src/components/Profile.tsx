import { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import { Camera, LogOut, Heart, MessageCircle, ArrowLeft } from "lucide-react";
import Avatar from "./Avatar";

export default function Profile({ 
  socket, 
  currentUserId, 
  viewingUserId,
  username: currentUsername, 
  avatar: currentAvatar, 
  color: currentColor, 
  onLogout, 
  onAvatarUpdated,
  onUserClick
}: { 
  socket: Socket | null, 
  currentUserId: number, 
  viewingUserId: number,
  username: string, 
  avatar: string | null, 
  color?: string, 
  onLogout: () => void, 
  onAvatarUpdated: (url: string) => void,
  onUserClick: (id: number) => void
}) {
  const [uploading, setUploading] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userPosts, setUserPosts] = useState<any[]>([]);

  const isMe = currentUserId === viewingUserId;

  useEffect(() => {
    if (!socket) return;
    
    if (isMe) {
      setUserProfile({
        id: currentUserId,
        username: currentUsername,
        avatar: currentAvatar,
        color: currentColor,
      });
    } else {
      socket.emit("get_user_profile", viewingUserId, (profile: any) => {
        setUserProfile(profile);
      });
    }

    socket.emit("get_user_posts", viewingUserId, (posts: any[]) => {
      setUserPosts(posts);
    });
  }, [socket, currentUserId, viewingUserId, currentUsername, currentAvatar, currentColor, isMe]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", e.target.files[0]);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && socket) {
        socket.emit("update_avatar", data.url);
        onAvatarUpdated(data.url);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  if (!userProfile) return <div className="flex-1 bg-slate-50"></div>;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 flex flex-col items-center">
      <div className="w-full max-w-2xl bg-white md:mt-8 md:rounded-t-3xl shadow-sm border-x border-t border-slate-100 p-8 pb-4 flex flex-col items-center relative">
        {!isMe && (
          <button onClick={() => onUserClick(currentUserId)} className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 bg-slate-50 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </button>
        )}
        
        <div className="relative mb-4 mt-4">
          <div className="w-28 h-28 md:w-32 md:h-32 rounded-full overflow-hidden bg-slate-100 border-4 border-white shadow-lg flex items-center justify-center">
            <Avatar url={userProfile.avatar} name={userProfile.username} color={userProfile.color} size={32} />
          </div>
          {isMe && (
            <label className="absolute bottom-0 right-0 w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center cursor-pointer shadow-md shadow-blue-500/20 transition-colors">
              <Camera size={20} />
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} disabled={uploading} />
            </label>
          )}
        </div>
        
        <h2 className="text-2xl font-bold text-slate-800 mb-1">{userProfile.username}</h2>
        <p className="text-slate-500 text-sm mb-6">{userPosts.length} Gönderi</p>

        {isMe && (
          <button 
            onClick={onLogout}
            className="w-full md:w-auto px-8 flex items-center justify-center gap-2 py-3 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-xl transition-colors mb-4"
          >
            <LogOut size={18} />
            Çıkış Yap
          </button>
        )}
      </div>

      <div className="w-full max-w-2xl bg-slate-50 p-4 space-y-4">
        <h3 className="font-bold text-slate-700 px-2 text-lg">Gönderiler</h3>
        {userPosts.length === 0 ? (
          <div className="text-center text-slate-400 p-8 bg-white rounded-2xl border border-slate-100 shadow-sm">
            Henüz gönderi yok.
          </div>
        ) : (
          userPosts.map(post => (
            <div key={post.id} className="bg-white border border-slate-100 rounded-2xl shadow-sm">
              <div className="p-4 flex items-center gap-3">
                <Avatar url={userProfile.avatar} name={userProfile.username} color={userProfile.color} size={10} />
                <div>
                  <h3 className="font-bold text-slate-800 text-[15px] leading-tight">{userProfile.username}</h3>
                  <p className="text-xs text-slate-400">{new Date(post.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
                </div>
              </div>
              
              {post.caption && <p className="px-4 pb-3 text-slate-800 text-[15px]">{post.caption}</p>}
              {post.image && <img src={post.image} className="w-full max-h-[500px] object-cover bg-slate-50" />}
              
              <div className="px-4 py-3 border-t border-slate-50 flex items-center gap-6">
                <div className="flex items-center gap-2 text-slate-500">
                  <Heart size={20} fill={post.is_liked ? 'currentColor' : 'none'} className={post.is_liked ? 'text-red-500' : ''} />
                  <span className="font-medium text-sm">{post.likes_count}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-500">
                  <MessageCircle size={20} />
                  <span className="font-medium text-sm">{post.comments?.length || 0} Yorum</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
