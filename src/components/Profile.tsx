import React, { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import { Camera, LogOut, Heart, MessageCircle, ArrowLeft, Maximize2, Lock, X, Trash2 } from "lucide-react";
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

    const loadProfile = () => {
      socket.emit("get_user_profile", viewingUserId, (profile: any) => {
        if (profile) {
          setUserProfile(profile);
        } else if (isMe) {
          // fallback
          setUserProfile({
            id: currentUserId,
            username: currentUsername,
            avatar: currentAvatar,
            color: currentColor,
            followersCount: 0,
            followingCount: 0
          });
        }
      });
    };

    const loadPosts = () => {
      socket.emit("get_user_posts", viewingUserId, (posts: any[]) => {
        setUserPosts(posts);
      });
    };

    loadProfile();
    loadPosts();
    socket.on("feed_updated", loadPosts);
    socket.on("profile_updated", (targetId) => {
      if (targetId === viewingUserId) {
        loadProfile();
      }
    });

    return () => {
      socket.off("feed_updated", loadPosts);
      socket.off("profile_updated");
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

  if (!userProfile) return <div className="flex-1 bg-slate-50 dark:bg-slate-950 transition-colors duration-200"></div>;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 flex flex-col items-center transition-colors duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 md:mt-8 md:rounded-t-3xl shadow-sm border-x border-t border-slate-100 dark:border-slate-800 p-8 pb-4 flex flex-col items-center relative transition-colors duration-200">
        {!isMe && (
          <button
            onClick={() => onUserClick(currentUserId)}
            className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded-full transition-colors cursor-pointer"
            title="Geri"
          >
            <ArrowLeft size={20} />
          </button>
        )}

        <div className="relative mb-4 mt-4">
          <div className="w-28 h-28 md:w-32 md:h-32 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 border-4 border-white dark:border-slate-900 shadow-lg flex items-center justify-center transition-colors">
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

        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">{userProfile.username}</h2>
        <div className="flex gap-4 text-slate-500 dark:text-slate-400 text-sm mb-4">
          <span className="font-semibold text-slate-800 dark:text-slate-200">{userPosts.length} <span className="font-normal text-slate-500">Gönderi</span></span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">{userProfile.followersCount || 0} <span className="font-normal text-slate-500">Takipçi</span></span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">{userProfile.followingCount || 0} <span className="font-normal text-slate-500">Takip</span></span>
        </div>

        {!isMe && (
          <div className="flex gap-2 w-full md:w-auto mb-6">
            <button
              onClick={() => socket?.emit("toggle_follow", userProfile.id)}
              className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl font-semibold transition-colors ${
                userProfile.isFollowing
                  ? "bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20"
              }`}
            >
              {userProfile.isFollowing ? "Takibi Bırak" : "Takip Et"}
            </button>
          </div>
        )}

        {isMe && (
          <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto mb-4">
            <button
              onClick={() => {
                setShowPasswordModal(true);
                setPasswordSuccess(false);
                setPasswordError("");
              }}
              className="px-6 flex items-center justify-center gap-2 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition-colors cursor-pointer"
            >
              <Lock size={18} />
              Şifre Değiştir
            </button>
            <button
              onClick={onLogout}
              className="px-6 flex items-center justify-center gap-2 py-2.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 font-semibold rounded-xl transition-colors cursor-pointer"
            >
              <LogOut size={18} />
              Çıkış Yap
            </button>
          </div>
        )}
      </div>

      <div className="w-full max-w-2xl bg-slate-50 dark:bg-slate-950 p-4 space-y-4 transition-colors duration-200">
        <h3 className="font-bold text-slate-700 dark:text-slate-300 px-2 text-lg">Gönderiler</h3>
        {userPosts.length === 0 ? (
          <div className="text-center text-slate-400 dark:text-slate-500 p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm transition-colors duration-200">
            Henüz gönderi yok.
          </div>
        ) : (
          userPosts.map((post) => (
            <div
              key={post.id}
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden transition-colors duration-200"
            >
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar
                    url={userProfile.avatar}
                    name={userProfile.username}
                    color={userProfile.color}
                    size={10}
                  />
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-[15px] leading-tight">
                      {userProfile.username}
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {new Date(post.created_at).toLocaleString([], {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                </div>
                {(isMe || currentUsername?.trim().toLowerCase() === 'emirgan') && (
                  <button
                    onClick={() => {
                      if (window.confirm("Bu gönderiyi silmek istediğinize emin misiniz?")) {
                        socket?.emit("delete_post", post.id);
                      }
                    }}
                    className="p-2 text-slate-400 hover:text-red-500 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
                    title={currentUsername?.trim().toLowerCase() === 'emirgan' && !isMe ? "Yönetici Olarak Sil" : "Gönderiyi Sil"}
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>

              {post.caption && (
                <p className="px-4 pb-3 text-slate-800 dark:text-slate-200 text-[15px] leading-relaxed whitespace-pre-wrap">{post.caption}</p>
              )}

              {post.image && (
                <div
                  className="relative group bg-slate-900 cursor-pointer overflow-hidden"
                  onClick={() => openPostModal(post)}
                >
                  {post.media_type === "video" ? (
                    <video
                      src={post.image}
                      autoPlay
                      muted
                      loop
                      playsInline
                      className="w-full max-h-[500px] object-contain bg-black pointer-events-none"
                    />
                  ) : (
                    <img
                      src={post.image}
                      alt={post.caption || "Gönderi"}
                      referrerPolicy="no-referrer"
                      className="w-full max-h-[500px] object-cover bg-slate-50 hover:opacity-95 transition-opacity"
                    />
                  )}
                  <div
                    className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm flex items-center gap-1 cursor-pointer"
                    title="Büyüt ve Bilgileri Gör"
                  >
                    <Maximize2 size={16} />
                    {post.media_type === "video" && <span className="text-xs pr-1 font-medium">Sesli İzle</span>}
                  </div>
                </div>
              )}

              <div className="px-4 py-3 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between transition-colors duration-200">
                <div className="flex items-center gap-6">
                  <button
                    onClick={() => handleLike(post.id)}
                    className={`flex items-center gap-2 transition-colors cursor-pointer ${
                      post.is_liked ? "text-red-500" : "text-slate-500 dark:text-slate-400 hover:text-red-500"
                    }`}
                  >
                    <Heart
                      size={20}
                      fill={post.is_liked ? "currentColor" : "none"}
                      className="transition-transform active:scale-125"
                    />
                    <span className="font-medium text-sm">{post.likes_count}</span>
                  </button>

                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <MessageCircle size={20} />
                    <span className="font-medium text-sm">
                      {post.comments?.length || 0} Yorum
                    </span>
                  </div>
                </div>

                {post.image && (
                  <button
                    onClick={() => openPostModal(post)}
                    className="text-xs text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 cursor-pointer transition-colors"
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
