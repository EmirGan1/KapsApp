import React, { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import { 
  Camera, LogOut, Heart, MessageCircle, ArrowLeft, Maximize2, Lock, X, Trash2, 
  UserX, AlertTriangle, Shield, ShieldAlert, Globe, UserPlus, UserMinus, UserCheck, MessageSquare, 
  Users, Search, Check, Clock 
} from "lucide-react";
import Avatar from "./Avatar";
import MediaModal from "./MediaModal";
import AdminModerationMenu from "./AdminModerationMenu";
import { MediaModalData } from "../types";
import { getApiUrl } from "../utils/api";

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
  onOpenChat,
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
  onOpenChat?: (userId: number) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [activeModalData, setActiveModalData] = useState<MediaModalData | null>(null);
  
  // Follower / Following Modal State
  const [followModalType, setFollowModalType] = useState<"followers" | "following" | null>(null);
  const [followList, setFollowList] = useState<any[]>([]);
  const [loadingFollowList, setLoadingFollowList] = useState(false);
  const [followSearchQuery, setFollowSearchQuery] = useState("");

  // Action Loading states
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [isFriendLoading, setIsFriendLoading] = useState(false);

  // Password Change State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Admin User Moderation State
  const [showDeleteUserModal, setShowDeleteUserModal] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [isBanningUser, setIsBanningUser] = useState(false);
  const [deleteUserError, setDeleteUserError] = useState("");

  const isMe = currentUserId === viewingUserId;
  const isEmirgan = currentUsername?.trim().toLowerCase() === "emirgan";

  const loadProfile = () => {
    if (!socket) return;
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
          followingCount: 0,
          isFollowing: false,
          friendStatus: "none"
        });
      }
    });
  };

  const loadPosts = () => {
    if (!socket) return;
    socket.emit("get_user_posts", viewingUserId, (posts: any[]) => {
      setUserPosts(posts || []);
    });
  };

  useEffect(() => {
    if (!socket) return;

    loadProfile();
    loadPosts();

    socket.on("feed_updated", loadPosts);
    const onPostDeleted = (data: any) => {
      const deletedId = Number(data?.postId || data?.id || data);
      setUserPosts((prev) => prev.filter((p) => p.id !== deletedId));
    };
    socket.on("post_deleted", onPostDeleted);
    
    const onProfileUpdated = (targetId: number) => {
      if (targetId === viewingUserId || targetId === currentUserId) {
        loadProfile();
      }
    };
    socket.on("profile_updated", onProfileUpdated);
    socket.on("friends_updated", loadProfile);

    return () => {
      socket.off("feed_updated", loadPosts);
      socket.off("post_deleted", onPostDeleted);
      socket.off("profile_updated", onProfileUpdated);
      socket.off("friends_updated", loadProfile);
    };
  }, [socket, currentUserId, viewingUserId, currentUsername, currentAvatar, currentColor, isMe]);

  const openFollowModal = (type: "followers" | "following") => {
    setFollowModalType(type);
    setFollowSearchQuery("");
    setLoadingFollowList(true);
    setFollowList([]);

    if (socket) {
      const eventName = type === "followers" ? "get_followers" : "get_following";
      socket.emit(eventName, viewingUserId, (list: any[]) => {
        setFollowList(list || []);
        setLoadingFollowList(false);
      });
    }
  };

  const handleToggleFollow = () => {
    if (!socket || !userProfile || isFollowLoading) return;
    setIsFollowLoading(true);
    socket.emit("toggle_follow", userProfile.id);
    // Optimistic UI update
    setUserProfile((prev: any) => prev ? {
      ...prev,
      isFollowing: !prev.isFollowing,
      followersCount: prev.isFollowing ? Math.max(0, (prev.followersCount || 1) - 1) : (prev.followersCount || 0) + 1
    } : prev);
    setTimeout(() => {
      setIsFollowLoading(false);
      loadProfile();
    }, 300);
  };

  const handleFriendAction = () => {
    if (!socket || !userProfile || isFriendLoading) return;
    setIsFriendLoading(true);
    const status = userProfile.friendStatus;

    if (status === "friends" || status === "pending_sent") {
      socket.emit("remove_friend", userProfile.id, () => {
        setIsFriendLoading(false);
        loadProfile();
      });
    } else if (status === "pending_received") {
      socket.emit("accept_friend", userProfile.id, () => {
        setIsFriendLoading(false);
        loadProfile();
      });
    } else {
      socket.emit("add_friend", userProfile.id, () => {
        setIsFriendLoading(false);
        loadProfile();
      });
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", e.target.files[0]);

    try {
      const res = await fetch(getApiUrl("/api/upload"), { method: "POST", body: formData });
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

  const handleDeletePost = async (postId: number) => {
    if (window.confirm("Bu gönderiyi silmek istediğinize emin misiniz?")) {
      setUserPosts((prev) => prev.filter((p) => p.id !== postId));
      if (socket) {
        socket.emit("delete_post", postId, (res: any) => {
          if (res?.error) {
            alert(res.error);
            socket.emit("get_user_posts", viewingUserId, (posts: any[]) => setUserPosts(posts));
          }
        });
      }
      const token = localStorage.getItem("token");
      if (token) {
        try {
          await fetch(getApiUrl(`/api/posts/${postId}`), {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch (e) {
          // Handled via socket
        }
      }
    }
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
        <div className="flex items-center gap-3 sm:gap-6 text-slate-500 dark:text-slate-400 text-sm mb-4">
          <div className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg">
            <span className="font-bold text-slate-900 dark:text-slate-100">{userPosts.length}</span>
            <span className="text-slate-500 text-xs sm:text-sm">Gönderi</span>
          </div>

          <button
            onClick={() => openFollowModal("followers")}
            className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer group"
            title="Takipçileri Görüntüle"
          >
            <span className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {userProfile.followersCount || 0}
            </span>
            <span className="text-slate-500 group-hover:text-slate-800 dark:group-hover:text-slate-200 text-xs sm:text-sm transition-colors">
              Takipçi
            </span>
          </button>

          <button
            onClick={() => openFollowModal("following")}
            className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer group"
            title="Takip Edilenleri Görüntüle"
          >
            <span className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {userProfile.followingCount || 0}
            </span>
            <span className="text-slate-500 group-hover:text-slate-800 dark:group-hover:text-slate-200 text-xs sm:text-sm transition-colors">
              Takip Edilen
            </span>
          </button>
        </div>

        {/* Admin IP & Security Information (Only visible to 'emirgan') */}
        {isEmirgan && (
          <div className="w-full max-w-md my-3 p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">
            <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-bold">
              <Shield size={15} className="text-blue-600 dark:text-blue-400" />
              <span>Yönetici Güvenlik Denetimi (IP Bilgileri)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="bg-white dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <Globe size={14} className="text-slate-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Kayıt IP Adresi</p>
                  <p className="font-mono font-medium text-slate-800 dark:text-slate-200 truncate" title={userProfile.signup_ip || "Kayıt yok"}>
                    {userProfile.signup_ip || "Bilinmiyor"}
                  </p>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <Globe size={14} className="text-emerald-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Son Giriş IP Adresi</p>
                  <p className="font-mono font-medium text-slate-800 dark:text-slate-200 truncate" title={userProfile.last_ip || "Kayıt yok"}>
                    {userProfile.last_ip || "Bilinmiyor"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {!isMe && (
          <div className="flex flex-wrap items-center justify-center gap-2.5 w-full md:w-auto mb-6">
            {/* Follow / Unfollow Button */}
            <button
              disabled={isFollowLoading}
              onClick={handleToggleFollow}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-all cursor-pointer text-sm shadow-sm ${
                userProfile.isFollowing
                  ? "bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20"
              } ${isFollowLoading ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              {userProfile.isFollowing ? (
                <>
                  <UserMinus size={16} />
                  <span>Takipten Çık</span>
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  <span>Takip Et</span>
                </>
              )}
            </button>

            {/* Friend Action Button */}
            <button
              disabled={isFriendLoading}
              onClick={handleFriendAction}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-all cursor-pointer text-sm shadow-sm ${
                userProfile.friendStatus === "friends"
                  ? "bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-700 dark:bg-slate-800 dark:hover:bg-red-950/40 dark:hover:text-red-400 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                  : userProfile.friendStatus === "pending_sent"
                  ? "bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                  : userProfile.friendStatus === "pending_received"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20"
                  : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
              } ${isFriendLoading ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              {userProfile.friendStatus === "friends" ? (
                <>
                  <UserCheck size={16} className="text-emerald-500" />
                  <span>Arkadaşlıktan Çıkar</span>
                </>
              ) : userProfile.friendStatus === "pending_sent" ? (
                <>
                  <Clock size={16} />
                  <span>İstek Gönderildi (İptal)</span>
                </>
              ) : userProfile.friendStatus === "pending_received" ? (
                <>
                  <Check size={16} />
                  <span>İsteği Kabul Et</span>
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  <span>Arkadaş Ekle</span>
                </>
              )}
            </button>

            {/* Direct Message Shortcut */}
            {onOpenChat && (
              <button
                onClick={() => onOpenChat(userProfile.id)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold transition-colors cursor-pointer text-sm"
                title="Mesaj Gönder"
              >
                <MessageSquare size={16} />
                <span>Mesaj</span>
              </button>
            )}

            {isEmirgan && (
              <AdminModerationMenu
                targetUserId={userProfile.id}
                targetUsername={userProfile.username}
                currentUsername={currentUsername}
                variant="button"
                onSuccess={() => {
                  onUserClick(currentUserId);
                }}
              />
            )}
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
                    type="button"
                    onClick={() => handleDeletePost(post.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 border border-red-200 dark:border-red-900/50 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                    title={currentUsername?.trim().toLowerCase() === 'emirgan' && !isMe ? "Yönetici Olarak Sil (emirgan)" : "Gönderiyi Sil"}
                  >
                    <Trash2 size={15} className="shrink-0" />
                    <span>Gönderiyi Sil</span>
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

      {/* Admin Delete User Confirmation Modal */}
      {showDeleteUserModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-500">
              <div className="p-3 bg-red-100 dark:bg-red-950/60 rounded-xl shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Kullanıcıyı Sil / Banla</h3>
                <p className="text-xs text-slate-500">Yönetici Yetkisi (emirgan)</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <strong className="text-slate-900 dark:text-slate-100 font-bold">"{userProfile?.username}"</strong> adlı kullanıcının hesabını ve bu hesaba ait tüm verileri (gönderiler, mesajlar, arkadaşlıklar, yorumlar vb.) veritabanından kalıcı olarak silmek üzeresiniz.
            </p>

            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300">
              ⚠️ Bu işlem geri alınamaz! Kullanıcı sisteme tekrar giriş yapamaz ve oturumu derhal sonlandırılır.
            </div>

            {deleteUserError && (
              <p className="text-xs text-red-600 font-semibold">{deleteUserError}</p>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isDeletingUser || isBanningUser}
                  onClick={() => {
                    setIsBanningUser(true);
                    setDeleteUserError("");
                    if (socket) {
                      socket.emit("ban_user", { userId: userProfile.id }, (res: any) => {
                        setIsBanningUser(false);
                        if (res?.error) {
                          setDeleteUserError(res.error);
                        } else {
                          setShowDeleteUserModal(false);
                          alert("Kullanıcı hesabı kural ihlali nedeniyle başarıyla banlandı.");
                          loadProfile();
                        }
                      });
                    }
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs transition-colors cursor-pointer shadow-md shadow-amber-600/20 flex items-center justify-center gap-1.5"
                >
                  <ShieldAlert size={14} />
                  {isBanningUser ? "Banlanıyor..." : "Hesabı Banla"}
                </button>

                <button
                  type="button"
                  disabled={isDeletingUser || isBanningUser}
                  onClick={() => {
                    setIsDeletingUser(true);
                    setDeleteUserError("");
                    if (socket) {
                      socket.emit("admin_delete_user", { userId: userProfile.id }, (res: any) => {
                        setIsDeletingUser(false);
                        if (res?.error) {
                          setDeleteUserError(res.error);
                        } else {
                          setShowDeleteUserModal(false);
                          alert("Kullanıcı ve tüm verileri başarıyla silindi.");
                          onUserClick(currentUserId);
                        }
                      });
                    }
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs transition-colors cursor-pointer shadow-md shadow-red-600/20 flex items-center justify-center gap-1.5"
                >
                  <UserX size={14} />
                  {isDeletingUser ? "Siliniyor..." : "Tüm Verileri Sil"}
                </button>
              </div>

              <button
                type="button"
                disabled={isDeletingUser || isBanningUser}
                onClick={() => setShowDeleteUserModal(false)}
                className="w-full py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                İptal / Vazgeç
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Followers / Following List Modal */}
      {followModalType && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={20} className="text-blue-600 dark:text-blue-400" />
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  {followModalType === "followers" ? "Takipçiler" : "Takip Edilenler"}
                </h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {followList.length}
                </span>
              </div>
              <button
                onClick={() => setFollowModalType(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Search Bar */}
            <div className="p-3 border-b border-slate-100 dark:border-slate-800">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Kullanıcı ara..."
                  value={followSearchQuery}
                  onChange={(e) => setFollowSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
            </div>

            {/* Modal User List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-[220px]">
              {loadingFollowList ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs">Yükleniyor...</span>
                </div>
              ) : followList.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  {followModalType === "followers" ? "Henüz takipçi yok." : "Henüz kimseyi takip etmiyor."}
                </div>
              ) : (
                followList
                  .filter((u) => u.username.toLowerCase().includes(followSearchQuery.toLowerCase()))
                  .map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setFollowModalType(null);
                        onUserClick(item.id);
                      }}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          url={item.avatar}
                          name={item.username}
                          color={item.color}
                          size={10}
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {item.username}
                          </p>
                          {item.id === currentUserId && (
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">Sen</span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFollowModalType(null);
                          onUserClick(item.id);
                        }}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/40 dark:hover:text-blue-400 text-slate-700 dark:text-slate-300 transition-colors"
                      >
                        Profili Gör
                      </button>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
