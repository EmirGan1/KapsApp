import React, { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import { Camera, LogOut, Heart, MessageCircle, ArrowLeft, Maximize2, Lock, X } from "lucide-react";
import Avatar from "./Avatar";
import MediaModal from "./MediaModal";
import { MediaModalData } from "../types";

export default function Profile({
  socket,
  currentUserId,
  viewingUserId,
  username: currentUsername,
  avatar: currentAvatar,
  color: currentColor,
  onLogout,
  onAvatarUpdated,
  onUserClick,
}: {
  socket: Socket | null;
  currentUserId: number;
  viewingUserId: number;
  username: string;
  avatar: string | null;
  color?: string;
  onLogout: () => void;
  onAvatarUpdated: (url: string) => void;
  onUserClick: (id: number) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [activeModalData, setActiveModalData] = useState<MediaModalData | null>(null);
  
  // Password Change State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

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

    const loadPosts = () => {
      socket.emit("get_user_posts", viewingUserId, (posts: any[]) => {
        setUserPosts(posts);
      });
    };

    loadPosts();
    socket.on("feed_updated", loadPosts);

    return () => {
      socket.off("feed_updated", loadPosts);
    };
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
      e.target.value = "";
    }
  };

  const handleLike = (postId: number) => {
    socket?.emit("like_post", postId);
  };

  const openPostModal = (post: any) => {
    if (!post.image) return;
    setActiveModalData({
      url: post.image,
      type: post.media_type === "video" ? "video" : "image",
      authorName: userProfile.username,
      authorAvatar: userProfile.avatar,
      authorColor: userProfile.color,
      authorId: userProfile.id,
      caption: post.caption,
      timestamp: post.created_at,
      postId: post.id,
      likesCount: post.likes_count,
      isLiked: post.is_liked,
      comments: post.comments || [],
      onLike: () => handleLike(post.id),
      onAddComment: (text: string) => {
        socket?.emit("add_comment", { postId: post.id, content: text });
      },
    });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess(false);
    if (!oldPassword || !newPassword) {
      setPasswordError("Lütfen tüm alanları doldurun.");
      return;
    }
    socket?.emit("change_password", { oldPassword, newPassword }, (res: any) => {
      if (res.error) {
        setPasswordError(res.error);
      } else {
        setPasswordSuccess(true);
        setOldPassword("");
        setNewPassword("");
        setTimeout(() => setShowPasswordModal(false), 2000);
      }
    });
  };

  if (!userProfile) return <div className="flex-1 bg-slate-50"></div>;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 flex flex-col items-center">
      <div className="w-full max-w-2xl bg-white md:mt-8 md:rounded-t-3xl shadow-sm border-x border-t border-slate-100 p-8 pb-4 flex flex-col items-center relative">
        {!isMe && (
          <button
            onClick={() => onUserClick(currentUserId)}
            className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 bg-slate-50 rounded-full transition-colors cursor-pointer"
            title="Geri"
          >
            <ArrowLeft size={20} />
          </button>
        )}

        <div className="relative mb-4 mt-4">
          <div className="w-28 h-28 md:w-32 md:h-32 rounded-full overflow-hidden bg-slate-100 border-4 border-white shadow-lg flex items-center justify-center">
            <Avatar
              url={userProfile.avatar}
              name={userProfile.username}
              color={userProfile.color}
              size={32}
            />
          </div>
          {isMe && (
            <label className="absolute bottom-0 right-0 w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center cursor-pointer shadow-md shadow-blue-500/20 transition-colors">
              <Camera size={20} />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
                disabled={uploading}
              />
            </label>
          )}
        </div>

        <h2 className="text-2xl font-bold text-slate-800 mb-1">{userProfile.username}</h2>
        <p className="text-slate-500 text-sm mb-6">{userPosts.length} Gönderi</p>

        {isMe && (
          <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto mb-4">
            <button
              onClick={() => {
                setShowPasswordModal(true);
                setPasswordSuccess(false);
                setPasswordError("");
              }}
              className="px-6 flex items-center justify-center gap-2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors cursor-pointer"
            >
              <Lock size={18} />
              Şifre Değiştir
            </button>
            <button
              onClick={onLogout}
              className="px-6 flex items-center justify-center gap-2 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-xl transition-colors cursor-pointer"
            >
              <LogOut size={18} />
              Çıkış Yap
            </button>
          </div>
        )}
      </div>

      <div className="w-full max-w-2xl bg-slate-50 p-4 space-y-4">
        <h3 className="font-bold text-slate-700 px-2 text-lg">Gönderiler</h3>
        {userPosts.length === 0 ? (
          <div className="text-center text-slate-400 p-8 bg-white rounded-2xl border border-slate-100 shadow-sm">
            Henüz gönderi yok.
          </div>
        ) : (
          userPosts.map((post) => (
            <div
              key={post.id}
              className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden"
            >
              <div className="p-4 flex items-center gap-3">
                <Avatar
                  url={userProfile.avatar}
                  name={userProfile.username}
                  color={userProfile.color}
                  size={10}
                />
                <div>
                  <h3 className="font-bold text-slate-800 text-[15px] leading-tight">
                    {userProfile.username}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {new Date(post.created_at).toLocaleString([], {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              </div>

              {post.caption && (
                <p className="px-4 pb-3 text-slate-800 text-[15px]">{post.caption}</p>
              )}

              {post.image && (
                <div
                  className="relative group bg-slate-900 cursor-pointer overflow-hidden"
                  onClick={() => openPostModal(post)}
                >
                  {post.media_type === "video" ? (
                    <video
                      src={post.image}
                      controls
                      playsInline
                      className="w-full max-h-[500px] object-contain bg-black"
                    />
                  ) : (
                    <img
                      src={post.image}
                      alt={post.caption || "Gönderi"}
                      referrerPolicy="no-referrer"
                      className="w-full max-h-[500px] object-cover bg-slate-50 hover:opacity-95 transition-opacity"
                    />
                  )}
                  <button
                    onClick={() => openPostModal(post)}
                    className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                    title="Büyüt ve Bilgileri Gör"
                  >
                    <Maximize2 size={16} />
                  </button>
                </div>
              )}

              <div className="px-4 py-3 border-t border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <button
                    onClick={() => handleLike(post.id)}
                    className={`flex items-center gap-2 transition-colors cursor-pointer ${
                      post.is_liked ? "text-red-500" : "text-slate-500 hover:text-red-500"
                    }`}
                  >
                    <Heart
                      size={20}
                      fill={post.is_liked ? "currentColor" : "none"}
                      className="transition-transform active:scale-125"
                    />
                    <span className="font-medium text-sm">{post.likes_count}</span>
                  </button>

                  <div className="flex items-center gap-2 text-slate-500">
                    <MessageCircle size={20} />
                    <span className="font-medium text-sm">
                      {post.comments?.length || 0} Yorum
                    </span>
                  </div>
                </div>

                {post.image && (
                  <button
                    onClick={() => openPostModal(post)}
                    className="text-xs text-slate-400 hover:text-blue-600 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Maximize2 size={14} />
                    <span>Detaylar</span>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Instagram-style Media Modal */}
      {activeModalData && (
        <MediaModal
          data={activeModalData}
          onClose={() => setActiveModalData(null)}
          onUserClick={onUserClick}
        />
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowPasswordModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                <Lock size={24} />
              </div>
            </div>
            <h2 className="text-xl font-bold text-center text-slate-800 mb-6">Şifre Değiştir</h2>
            
            {passwordSuccess ? (
              <div className="text-center p-4 bg-green-50 text-green-700 rounded-xl font-medium">
                Şifreniz başarıyla değiştirildi!
              </div>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-4">
                {passwordError && (
                  <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl text-center">
                    {passwordError}
                  </div>
                )}
                <div>
                  <input
                    type="password"
                    placeholder="Eski Şifre"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <input
                    type="password"
                    placeholder="Yeni Şifre"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all active:scale-[0.98]"
                >
                  Şifreyi Güncelle
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
