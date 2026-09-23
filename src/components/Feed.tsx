import React, { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import { Post, Story, MediaModalData } from "../types";
import { Heart, MessageCircle, ImagePlus, Plus, Send, Film, Maximize2, Trash2, Loader2 } from "lucide-react";
import Avatar from "./Avatar";
import MediaModal from "./MediaModal";
import AdminModerationMenu from "./AdminModerationMenu";
import { getApiUrl } from "../utils/api";
import { compressImage } from "../utils/imageCompressor";

export default function Feed({
  socket,
  currentUserId,
  currentUsername,
  onUserClick,
  activeSubject
}: {
  socket: Socket | null;
  currentUserId: number;
  currentUsername?: string;
  onUserClick?: (id: number) => void;
  activeSubject?: string | null;
}) {
  const isAdmin = currentUsername?.toLowerCase() === 'emirhan' || currentUsername?.toLowerCase() === 'admin' || currentUserId === 1;
  const [posts, setPosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<Story[]>([]);

  const [newPostCaption, setNewPostCaption] = useState("");
  const [newPostMedia, setNewPostMedia] = useState<File | null>(null);
  const [newPostMediaType, setNewPostMediaType] = useState<"image" | "video">("image");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [activeCommentsPostId, setActiveCommentsPostId] = useState<number | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");

  const [activeModalData, setActiveModalData] = useState<MediaModalData | null>(null);

  useEffect(() => {
    const loadData = () => {
      if (socket && socket.connected) {
        socket.emit("get_feed", activeSubject || null, (data: Post[]) => {
          if (Array.isArray(data)) setPosts(data);
        });
        socket.emit("get_stories", (data: Story[]) => {
          if (Array.isArray(data)) setStories(data);
        });
      } else {
        const token = localStorage.getItem("lan_token") || localStorage.getItem("token");
        fetch(getApiUrl(`/api/feed${activeSubject ? `?subject=${encodeURIComponent(activeSubject)}` : ""}`), {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        })
          .then((res) => res.json())
          .then((data) => {
            if (Array.isArray(data)) setPosts(data);
          })
          .catch((err) => console.error("Feed fetch error:", err));
      }
    };

    loadData();

    if (socket) {
      socket.on("feed_updated", loadData);
      socket.on("stories_updated", loadData);

      const onNewPost = (newPost: any) => {
        if (!newPost || !newPost.id) return;
        // If subject filter is active, only add if matching
        if (activeSubject && newPost.subject !== activeSubject) return;
        setPosts((prev) => {
          if (prev.some((p) => p.id === newPost.id)) return prev;
          return [newPost, ...prev];
        });
      };
      socket.on("new_post", onNewPost);
      
      const onPostDeleted = (data: any) => {
        const deletedId = Number(data?.postId || data?.id || data);
        if (!isNaN(deletedId)) {
          setPosts((prev) => prev.filter((p) => Number(p.id) !== deletedId));
        }
      };
      socket.on("post_deleted", onPostDeleted);

      return () => {
        socket.off("feed_updated", loadData);
        socket.off("stories_updated", loadData);
        socket.off("new_post", onNewPost);
        socket.off("post_deleted", onPostDeleted);
      };
    }
  }, [socket, activeSubject]);

  useEffect(() => {
    if (activeCommentsPostId && socket) {
      socket.emit("get_comments", activeCommentsPostId, (data: any[]) => setComments(data));
      const onCommentsUpdated = (postId: number) => {
        if (postId === activeCommentsPostId) {
          socket.emit("get_comments", activeCommentsPostId, (data: any[]) => setComments(data));
        }
      };
      socket.on("comments_updated", onCommentsUpdated);
      return () => {
        socket.off("comments_updated", onCommentsUpdated);
      };
    }
  }, [activeCommentsPostId, socket]);

  // Keep active modal comments & likes in sync with live data
  useEffect(() => {
    if (activeModalData && activeModalData.postId) {
      const currentPost = posts.find((p) => p.id === activeModalData.postId);
      if (currentPost) {
        setActiveModalData((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            likesCount: currentPost.likes_count,
            isLiked: currentPost.is_liked,
            comments: prev.postId === activeCommentsPostId ? comments : prev.comments,
          };
        });
      }
    }
  }, [posts, comments, activeCommentsPostId]);

  const handleMediaSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith("video/")) {
      setNewPostMedia(file);
      setNewPostMediaType("video");
    } else {
      try {
        const compressed = await compressImage(file, { maxWidth: 1920, maxHeight: 1080, quality: 0.85 });
        setNewPostMedia(compressed.file);
        setNewPostMediaType("image");
      } catch {
        setNewPostMedia(file);
        setNewPostMediaType("image");
      }
    }
  };

  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const captionTrimmed = newPostCaption.trim();
    if (!captionTrimmed && !newPostMedia) return;
    if (isSubmitting) return;

    setIsSubmitting(true);
    let mediaUrl: string | null = null;
    let finalMediaType = newPostMediaType;

    if (newPostMedia) {
      const formData = new FormData();
      formData.append("file", newPostMedia);
      try {
        const res = await fetch(getApiUrl("/api/upload"), { method: "POST", body: formData });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Dosya yüklenemedi (${res.status})`);
        }
        const data = await res.json();
        if (!data.url) {
          throw new Error("Yüklenen dosya URL'si alınamadı.");
        }
        mediaUrl = data.url;
        if (data.media_type === "video") finalMediaType = "video";
      } catch (err: any) {
        console.error("Media upload error:", err);
        alert(err.message || "Dosya yüklenirken bir hata oluştu.");
        setIsSubmitting(false);
        return;
      }
    }

    const payload = {
      image: mediaUrl || null,
      media_type: finalMediaType,
      caption: captionTrimmed,
      subject: activeSubject || null
    };

    const token = localStorage.getItem("lan_token") || localStorage.getItem("token");

    const refreshFeed = () => {
      if (socket && socket.connected) {
        socket.emit("get_feed", activeSubject || null, (data: Post[]) => {
          if (Array.isArray(data)) setPosts(data);
        });
      } else {
        fetch(getApiUrl(`/api/feed${activeSubject ? `?subject=${encodeURIComponent(activeSubject)}` : ""}`), {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        })
          .then((res) => res.json())
          .then((data) => {
            if (Array.isArray(data)) setPosts(data);
          })
          .catch(() => {});
      }
    };

    const onSuccess = (createdPost?: any) => {
      setNewPostCaption("");
      setNewPostMedia(null);
      setIsSubmitting(false);
      if (createdPost && createdPost.id) {
        setPosts((prev) => {
          if (prev.some((p) => p.id === createdPost.id)) return prev;
          return [createdPost, ...prev];
        });
      }
      refreshFeed();
    };

    // If socket is available and connected, send via socket with callback and REST fallback
    if (socket && socket.connected) {
      socket.emit("create_post", payload, async (res: any) => {
        if (res?.error) {
          console.warn("Socket create_post error, trying REST API:", res.error);
          try {
            const restRes = await fetch(getApiUrl("/api/posts"), {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {})
              },
              body: JSON.stringify(payload)
            });
            const restData = await restRes.json();
            if (!restRes.ok || restData.error) {
              alert(restData.error || res.error || "Gönderi paylaşılamadı.");
              setIsSubmitting(false);
              return;
            }
            onSuccess(restData.post);
          } catch (e: any) {
            alert(res.error || e.message || "Gönderi paylaşılamadı.");
            setIsSubmitting(false);
          }
        } else {
          onSuccess(res?.post);
        }
      });
    } else {
      // Socket not connected, send directly via REST API
      try {
        const restRes = await fetch(getApiUrl("/api/posts"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify(payload)
        });
        const restData = await restRes.json();
        if (!restRes.ok || restData.error) {
          alert(restData.error || "Gönderi paylaşılamadı.");
          setIsSubmitting(false);
          return;
        }
        onSuccess(restData.post);
      } catch (err: any) {
        alert(err.message || "Gönderi paylaşılamadı. Lütfen bağlantınızı kontrol edin.");
        setIsSubmitting(false);
      }
    }
  };

  const handleStoryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile || !socket) return;
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
        socket.emit("create_story", data.url);
      }
    } catch (err) {
      console.error("Story upload error:", err);
    } finally {
      e.target.value = "";
    }
  };

  const handleLike = (postId: number) => {
    socket?.emit("like_post", postId);
  };

  const handleDeletePost = async (postId: number) => {
    // Optimistically and immediately remove from local state
    const targetId = Number(postId);
    setPosts((prev) => prev.filter((p) => Number(p.id) !== targetId));
    if (activeModalData && Number(activeModalData.postId) === targetId) {
      setActiveModalData(null);
    }

    if (socket) {
      socket.emit("delete_post", targetId, (res: any) => {
        if (res?.error) {
          console.error("delete_post socket error:", res.error);
          socket.emit("get_feed", activeSubject || null, (data: Post[]) => setPosts(data));
        }
      });
    }

    const token = localStorage.getItem("lan_token") || localStorage.getItem("token");
    if (token) {
      try {
        const res = await fetch(getApiUrl(`/api/posts/${targetId}`), {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setPosts((prev) => prev.filter((p) => Number(p.id) !== targetId));
        }
      } catch (e) {
        // Socket handles the deletion
      }
    }
  };

  const handleDeleteComment = async (commentId: number, postId: number) => {
    setComments((prev) => prev.filter((c) => Number(c.id) !== Number(commentId)));
    if (socket) {
      socket.emit("delete_comment", { commentId, postId }, (res: any) => {
        if (res?.error) {
          console.error("delete_comment error:", res.error);
          socket.emit("get_comments", postId, (data: Comment[]) => setComments(data));
        }
      });
    }

    const token = localStorage.getItem("lan_token") || localStorage.getItem("token");
    if (token) {
      fetch(getApiUrl(`/api/comments/${commentId}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  };

  const toggleComments = (postId: number) => {
    if (activeCommentsPostId === postId) {
      setActiveCommentsPostId(null);
    } else {
      setActiveCommentsPostId(postId);
      setNewComment("");
    }
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !socket || !activeCommentsPostId) return;
    socket.emit("add_comment", { postId: activeCommentsPostId, content: newComment.trim() });
    setNewComment("");
  };

  const openPostModal = (post: Post) => {
    if (!post.image) return;
    setActiveCommentsPostId(post.id);
    socket?.emit("get_comments", post.id, (loadedComments: any[]) => {
      setComments(loadedComments);
      setActiveModalData({
        url: post.image!,
        type: post.media_type === "video" ? "video" : "image",
        authorName: post.username,
        authorAvatar: post.avatar,
        authorColor: post.color,
        authorId: post.user_id,
        caption: post.caption,
        timestamp: post.created_at,
        postId: post.id,
        likesCount: post.likes_count,
        isLiked: post.is_liked,
        comments: loadedComments,
        onLike: () => handleLike(post.id),
        onAddComment: (text: string) => {
          socket?.emit("add_comment", { postId: post.id, content: text });
        },
      });
    });
  };

  const openStoryModal = (story: Story) => {
    const isVideo = story.image.endsWith(".mp4") || story.image.endsWith(".webm") || story.media_type === "video";
    setActiveModalData({
      url: story.image,
      type: isVideo ? "video" : "image",
      authorName: story.username,
      authorAvatar: story.avatar,
      authorColor: story.color,
      authorId: story.user_id,
      caption: "Hikaye",
      timestamp: story.created_at,
    });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      <div className="max-w-xl mx-auto pb-20">
        
        {/* Subject Header */}
        {activeSubject && (
          <div className="bg-white dark:bg-slate-900 px-6 py-4 border-b border-slate-100 dark:border-slate-800 shadow-sm sticky top-0 z-20 transition-colors duration-200">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="text-blue-500">#</span> {activeSubject}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Discussions and files for {activeSubject}</p>
          </div>
        )}

        {/* Stories - Only show if not in a subject feed */}
        {!activeSubject && (
          <div className="bg-white dark:bg-slate-900 p-4 border-b border-slate-100 dark:border-slate-800 flex gap-4 overflow-x-auto shadow-sm sticky top-0 z-10 scrollbar-hide transition-colors duration-200">
            <div className="flex flex-col items-center gap-1 min-w-[72px]">
              <div className="relative w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-500 transition-colors">
                <Plus size={24} className="text-slate-400 dark:text-slate-500" />
                <input
                  type="file"
                  accept="image/*,video/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={handleStoryUpload}
                />
              </div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Hikaye Ekle</span>
            </div>
            {stories.map((story) => (
              <div
                key={story.id}
                className="flex flex-col items-center gap-1 min-w-[72px] cursor-pointer group"
                onClick={() => openStoryModal(story)}
              >
                <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-fuchsia-600 transition-transform group-hover:scale-105">
                  {story.image.endsWith(".mp4") || story.image.endsWith(".webm") ? (
                    <div className="w-full h-full rounded-full border-2 border-white dark:border-slate-900 bg-black flex items-center justify-center overflow-hidden">
                      <Film size={20} className="text-white" />
                    </div>
                  ) : (
                    <img
                      src={story.image}
                      referrerPolicy="no-referrer"
                      alt={story.username}
                      className="w-full h-full rounded-full object-cover border-2 border-white dark:border-slate-900 bg-white dark:bg-slate-900"
                    />
                  )}
                </div>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate w-full text-center group-hover:underline">
                  {story.username}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Create Post */}
        <div className="bg-white dark:bg-slate-900 p-4 my-4 shadow-sm border border-slate-100 dark:border-slate-800 md:rounded-2xl mx-0 md:mx-4 lg:mx-0 transition-colors duration-200">
          <form onSubmit={handlePostSubmit}>
            <textarea
              placeholder="Ne düşünüyorsun? Fotoğraf veya video paylaş... (Ctrl+Enter ile paylaş)"
              className="w-full bg-transparent border-none focus:ring-0 resize-none mb-3 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none p-2 text-base md:text-lg"
              rows={2}
              value={newPostCaption}
              onChange={(e) => setNewPostCaption(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handlePostSubmit(e);
                }
              }}
            />

            {/* Media Preview */}
            {newPostMedia && (
              <div className="relative mb-3 bg-black rounded-xl overflow-hidden max-h-72 flex items-center justify-center">
                {newPostMediaType === "video" ? (
                  <video
                    src={URL.createObjectURL(newPostMedia)}
                    controls
                    className="max-h-72 w-full object-contain"
                  />
                ) : (
                  <img
                    src={URL.createObjectURL(newPostMedia)}
                    alt="Önizleme"
                    className="max-h-72 w-full object-contain"
                  />
                )}
                <button
                  type="button"
                  onClick={() => setNewPostMedia(null)}
                  className="absolute top-2 right-2 bg-black/70 hover:bg-black text-white rounded-full p-1.5 text-xs transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-50 dark:border-slate-800 pt-3">
              <div className="flex items-center gap-1">
                <label className="text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 px-3 py-2 rounded-full cursor-pointer transition-colors flex items-center gap-2">
                  <ImagePlus size={20} />
                  <span className="text-sm font-medium">Fotoğraf / Video</span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={handleMediaSelect}
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={(!newPostCaption.trim() && !newPostMedia) || isSubmitting}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-full shadow-md transition-colors cursor-pointer flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Paylaşılıyor...</span>
                  </>
                ) : (
                  <span>Paylaş</span>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Posts List */}
        <div className="space-y-4 md:px-0 mx-0 md:mx-4 lg:mx-0">
          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-white dark:bg-slate-900 border-y md:border border-slate-100 dark:border-slate-800 md:rounded-2xl shadow-sm overflow-hidden transition-colors duration-200"
            >
              {/* Post Header */}
              <div className="p-4 flex items-center gap-3">
                <div
                  className="cursor-pointer"
                  onClick={() => onUserClick && onUserClick(post.user_id)}
                >
                  <Avatar url={post.avatar} name={post.username} color={post.color} size={10} />
                </div>
                <div className="flex-1">
                  <h3
                    className="font-bold text-slate-800 dark:text-slate-200 text-[15px] leading-tight cursor-pointer hover:underline inline-block"
                    onClick={() => onUserClick && onUserClick(post.user_id)}
                  >
                    {post.username}
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {new Date(post.created_at).toLocaleString("tr-TR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Emirgan Moderation Menu (Kullanıcı Sil / Banla / Cihaz Banı) */}
                  {currentUsername?.trim().toLowerCase() === 'emirgan' && post.username?.trim().toLowerCase() !== 'emirgan' && (
                    <AdminModerationMenu
                      targetUserId={post.user_id}
                      targetUsername={post.username}
                      currentUsername={currentUsername}
                      variant="dots"
                      onSuccess={() => {
                        // Refresh feed
                        socket?.emit("get_feed");
                      }}
                    />
                  )}

                  {/* Gönderi Silme Butonu: Sadece gönderinin sahibi VEYA currentUser.username === 'emirgan' */}
                  {(Number(post.user_id) === Number(currentUserId) || currentUsername?.trim().toLowerCase() === 'emirgan') && (
                    <button
                      type="button"
                      onClick={() => handleDeletePost(post.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 border border-red-200 dark:border-red-900/50 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                      title={currentUsername?.trim().toLowerCase() === 'emirgan' && Number(post.user_id) !== Number(currentUserId) ? "Yönetici Olarak Sil (emirgan)" : "Gönderiyi Sil"}
                    >
                      <Trash2 size={15} className="shrink-0" />
                      <span className="hidden sm:inline">Gönderiyi Sil</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Caption */}
              {post.caption && (
                <p className="px-4 pb-3 text-slate-800 dark:text-slate-200 text-[15px] leading-relaxed whitespace-pre-wrap">
                  {post.caption}
                </p>
              )}

              {/* Media (Image or Video) with Instagram Lightbox Trigger */}
              {post.image && (
                <div className="relative group bg-slate-900 overflow-hidden cursor-pointer" onClick={() => openPostModal(post)}>
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
                      className="w-full max-h-[500px] object-cover bg-slate-50 transition-transform duration-300 group-hover:scale-[1.01]"
                    />
                  )}

                  {/* Expand button (Instagram style trigger) */}
                  <div
                    className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm flex items-center gap-1"
                    title="Büyüt ve Bilgileri Gör"
                  >
                    <Maximize2 size={16} />
                    {post.media_type === "video" && <span className="text-xs pr-1 font-medium">Sesli İzle</span>}
                  </div>
                </div>
              )}

              {/* Action Bar */}
              <div className="px-4 py-3 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between transition-colors duration-200">
                <div className="flex items-center gap-6">
                  <button
                    onClick={() => handleLike(post.id)}
                    className={`flex items-center gap-2 transition-colors cursor-pointer ${
                      post.is_liked ? "text-red-500" : "text-slate-500 dark:text-slate-400 hover:text-red-500"
                    }`}
                  >
                    <Heart
                      size={22}
                      fill={post.is_liked ? "currentColor" : "none"}
                      className="transition-transform active:scale-125"
                    />
                    <span className="font-medium text-sm">{post.likes_count}</span>
                  </button>

                  <button
                    onClick={() => toggleComments(post.id)}
                    className={`flex items-center gap-2 transition-colors cursor-pointer ${
                      activeCommentsPostId === post.id
                        ? "text-blue-500"
                        : "text-slate-500 dark:text-slate-400 hover:text-blue-500"
                    }`}
                  >
                    <MessageCircle size={22} />
                    <span className="font-medium text-sm">Yorum</span>
                  </button>
                </div>

                {post.image && (
                  <button
                    onClick={() => openPostModal(post)}
                    className="text-xs text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Maximize2 size={14} />
                    <span>Detaylar</span>
                  </button>
                )}
              </div>

              {/* Comments Section */}
              {activeCommentsPostId === post.id && (
                <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-b-2xl transition-colors duration-200">
                  <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
                    {comments.length === 0 ? (
                      <p className="text-center text-xs text-slate-400 dark:text-slate-500 py-2">
                        Henüz yorum yok. İlk yorumu sen yap!
                      </p>
                    ) : (
                      comments.map((c) => (
                        <div key={c.id} className="flex gap-2">
                          <div
                            className="cursor-pointer"
                            onClick={() => onUserClick && onUserClick(c.user_id)}
                          >
                            <Avatar url={c.avatar} name={c.username} color={c.color} size={6} />
                          </div>
                          <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex-1 transition-colors duration-200 group relative">
                            <div className="flex items-center justify-between">
                              <div
                                className="font-semibold text-xs text-slate-800 dark:text-slate-200 cursor-pointer hover:underline inline-block"
                                onClick={() => onUserClick && onUserClick(c.user_id)}
                              >
                                {c.username}
                              </div>
                              {(c.user_id === currentUserId || isAdmin) && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteComment(c.id, post.id)}
                                  className="text-slate-400 hover:text-red-500 opacity-80 hover:opacity-100 p-0.5 rounded transition-colors"
                                  title="Yorumu Sil"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                            <div className="text-sm text-slate-600 dark:text-slate-300 break-words leading-relaxed mt-0.5">
                              {c.content}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <form onSubmit={handleAddComment} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Yorum ekle..."
                      className="flex-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-sm px-4 py-2 focus:ring-2 focus:ring-blue-500 text-sm outline-none transition-colors duration-200"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                    />
                    <button
                      type="submit"
                      disabled={!newComment.trim()}
                      className="bg-blue-600 text-white rounded-full p-2 disabled:opacity-50 hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
                    >
                      <Send size={16} />
                    </button>
                  </form>
                </div>
              )}
            </div>
          ))}

          {posts.length === 0 && (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 md:rounded-2xl border-y md:border border-slate-100 dark:border-slate-800 shadow-sm transition-colors duration-200">
              Henüz gönderi yok.
            </div>
          )}
        </div>
      </div>

      {/* Instagram-Style Modal */}
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
