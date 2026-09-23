import React, { useState, useEffect, useRef, useCallback } from "react";
import { Socket } from "socket.io-client";
import { Post, Story, MediaModalData } from "../types";
import { 
  Heart, 
  MessageCircle, 
  ImagePlus, 
  Plus, 
  Send, 
  Film, 
  Maximize2, 
  Trash2, 
  Loader2, 
  LayoutGrid, 
  List, 
  Folder, 
  Sparkles,
  ChevronDown
} from "lucide-react";
import Avatar from "./Avatar";
import MediaModal from "./MediaModal";
import AdminModerationMenu from "./AdminModerationMenu";
import PostMediaFrame from "./PostMediaFrame";
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
  const isAdmin = currentUsername?.toLowerCase() === 'emirgan' || currentUsername?.toLowerCase() === 'emirhan' || currentUsername?.toLowerCase() === 'admin' || currentUserId === 1;
  const [posts, setPosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

  // Folder View Mode: 'feed' or 'gallery'
  const [folderViewMode, setFolderViewMode] = useState<"feed" | "gallery">("feed");

  const [newPostCaption, setNewPostCaption] = useState("");
  const [newPostMedia, setNewPostMedia] = useState<File | null>(null);
  const [newPostMediaType, setNewPostMediaType] = useState<"image" | "video">("image");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [activeCommentsPostId, setActiveCommentsPostId] = useState<number | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");

  const [activeModalData, setActiveModalData] = useState<MediaModalData | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Initial load or subject change
  useEffect(() => {
    setHasMore(true);
    setIsLoadingOlder(false);

    const loadData = () => {
      if (socket && socket.connected) {
        socket.emit("get_feed", { subject: activeSubject || null, limit: 50 }, (data: Post[]) => {
          if (Array.isArray(data)) {
            setPosts(data);
            if (data.length < 50) setHasMore(false);
          }
        });
        socket.emit("get_stories", (data: Story[]) => {
          if (Array.isArray(data)) setStories(data);
        });
      } else {
        const token = localStorage.getItem("lan_token") || localStorage.getItem("token");
        fetch(getApiUrl(`/api/feed?limit=50${activeSubject ? `&subject=${encodeURIComponent(activeSubject)}` : ""}`), {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        })
          .then((res) => res.json())
          .then((data) => {
            if (Array.isArray(data)) {
              setPosts(data);
              if (data.length < 50) setHasMore(false);
            }
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
        if (activeSubject && newPost.subject?.toLowerCase() !== activeSubject.toLowerCase()) return;
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

  // Load older posts (Infinite Scroll)
  const loadOlderPosts = useCallback(() => {
    if (isLoadingOlder || !hasMore || posts.length === 0) return;
    const oldestId = posts[posts.length - 1]?.id;
    if (!oldestId) return;

    setIsLoadingOlder(true);

    const handleOlderData = (olderPosts: Post[]) => {
      setIsLoadingOlder(false);
      if (!Array.isArray(olderPosts) || olderPosts.length === 0) {
        setHasMore(false);
        return;
      }
      if (olderPosts.length < 50) {
        setHasMore(false);
      }

      setPosts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const uniqueOlder = olderPosts.filter((p) => !existingIds.has(p.id));
        if (uniqueOlder.length === 0) {
          setHasMore(false);
          return prev;
        }
        return [...prev, ...uniqueOlder];
      });
    };

    if (socket && socket.connected) {
      socket.emit("get_feed", { subject: activeSubject || null, beforeId: oldestId, limit: 50 }, handleOlderData);
    } else {
      const token = localStorage.getItem("lan_token") || localStorage.getItem("token");
      fetch(getApiUrl(`/api/feed?limit=50&before=${oldestId}${activeSubject ? `&subject=${encodeURIComponent(activeSubject)}` : ""}`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
        .then((res) => res.json())
        .then(handleOlderData)
        .catch(() => setIsLoadingOlder(false));
    }
  }, [isLoadingOlder, hasMore, posts, socket, activeSubject]);

  // Intersection Observer for auto-infinite scrolling
  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingOlder) {
          loadOlderPosts();
        }
      },
      { rootMargin: "250px" }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [loadOlderPosts, hasMore, isLoadingOlder]);

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
        socket.emit("get_feed", { subject: activeSubject || null, limit: 50 }, (data: Post[]) => {
          if (Array.isArray(data)) setPosts(data);
        });
      } else {
        fetch(getApiUrl(`/api/feed?limit=50${activeSubject ? `&subject=${encodeURIComponent(activeSubject)}` : ""}`), {
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

    if (socket && socket.connected) {
      socket.emit("create_post", payload, async (res: any) => {
        if (res?.error) {
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
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    if (activeModalData?.postId === postId) {
      setActiveModalData(null);
    }

    if (socket) {
      socket.emit("delete_post", { postId, id: postId }, (res: any) => {
        if (res?.error) {
          console.error("Socket delete_post error:", res.error);
        }
      });
    }

    const token = localStorage.getItem("lan_token") || localStorage.getItem("token");
    if (token) {
      fetch(getApiUrl(`/api/posts/${postId}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      }).catch((err) => console.error("REST delete_post error:", err));
    }
  };

  const toggleComments = (postId: number) => {
    if (activeCommentsPostId === postId) {
      setActiveCommentsPostId(null);
    } else {
      setActiveCommentsPostId(postId);
    }
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !activeCommentsPostId) return;
    socket?.emit("create_comment", {
      postId: activeCommentsPostId,
      content: newComment.trim(),
    });
    setNewComment("");
  };

  const handleDeleteComment = (commentId: number, postId: number) => {
    socket?.emit("delete_comment", { commentId, postId });
  };

  const openPostModal = (post: Post) => {
    setActiveCommentsPostId(post.id);
    setActiveModalData({
      url: post.image!,
      type: post.media_type || "image",
      postId: post.id,
      authorName: post.username,
      authorAvatar: post.avatar,
      authorColor: post.color,
      authorId: post.user_id,
      caption: post.caption,
      timestamp: post.created_at,
      likesCount: post.likes_count,
      isLiked: post.is_liked,
      comments: comments,
      onLike: () => handleLike(post.id),
      onAddComment: (content: string) => {
        socket?.emit("create_comment", {
          postId: post.id,
          content,
        });
      },
      onDeleteComment: (commentId: number) => {
        handleDeleteComment(commentId, post.id);
      },
      onDeletePost: (postId: number) => {
        handleDeletePost(postId);
      },
    });
  };

  const openStoryModal = (story: Story) => {
    const isVideo = story.image.endsWith(".mp4") || story.image.endsWith(".webm");
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

  const mediaPosts = posts.filter(p => !!p.image);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      <div className="max-w-xl mx-auto pb-24">
        
        {/* Subject Header & Folder Gallery Switch */}
        {activeSubject && (
          <div className="bg-white dark:bg-slate-900 px-5 py-4 border-b border-slate-200 dark:border-slate-800 shadow-sm sticky top-0 z-20 transition-colors duration-200">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-inner">
                  <Folder size={20} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                      {activeSubject}
                    </h2>
                    <span className="px-2 py-0.5 text-[11px] font-semibold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-full">
                      {posts.length} Gönderi
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {mediaPosts.length} Medya dosyası & arşiv
                  </p>
                </div>
              </div>

              {/* View Mode Toggle: Feed vs Gallery */}
              <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0">
                <button
                  type="button"
                  onClick={() => setFolderViewMode("feed")}
                  className={`p-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    folderViewMode === "feed"
                      ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                  title="Akış Görünümü"
                >
                  <List size={14} />
                  <span className="hidden sm:inline">Akış</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFolderViewMode("gallery")}
                  className={`p-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    folderViewMode === "gallery"
                      ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                  title="Galeri / Tüm Fotoğraflar"
                >
                  <LayoutGrid size={14} />
                  <span className="hidden sm:inline">Galeri</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stories - Only show on main general feed */}
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

        {/* Create Post Form */}
        <div className="bg-white dark:bg-slate-900 p-4 my-4 shadow-sm border border-slate-100 dark:border-slate-800 md:rounded-2xl mx-0 md:mx-4 lg:mx-0 transition-colors duration-200">
          <form onSubmit={handlePostSubmit}>
            <textarea
              placeholder={activeSubject ? `${activeSubject} klasöründe fotoğraf, video veya düşünce paylaş...` : "Ne düşünüyorsun? Fotoğraf veya video paylaş... (Ctrl+Enter ile paylaş)"}
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

            {/* Media Preview before uploading */}
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

            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
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

        {/* Gallery View (When user selects Galeri mode inside folder) */}
        {activeSubject && folderViewMode === "gallery" ? (
          <div className="px-3 sm:px-0">
            {mediaPosts.length === 0 ? (
              <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                <Film size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="font-medium text-slate-700 dark:text-slate-300">Bu klasörde henüz medya bulunmuyor.</p>
                <p className="text-xs text-slate-400 mt-1">Yukarıdaki alandan ilk fotoğraf veya videoyu yükleyebilirsiniz.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {mediaPosts.map((post) => (
                  <div
                    key={`gal_${post.id}`}
                    onClick={() => openPostModal(post)}
                    className="relative aspect-square bg-neutral-900 rounded-xl overflow-hidden group cursor-pointer border border-neutral-800 shadow-xs"
                  >
                    {/* Ambient Blur */}
                    <img
                      src={post.image!}
                      alt=""
                      aria-hidden="true"
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 w-full h-full object-cover blur-xl opacity-40 scale-125 pointer-events-none"
                    />
                    {/* Foreground Object Contain */}
                    <img
                      src={post.image!}
                      alt={post.caption || "Medya"}
                      referrerPolicy="no-referrer"
                      className="relative z-10 w-full h-full object-contain p-1 transition-transform duration-300 group-hover:scale-105"
                    />
                    {post.media_type === "video" && (
                      <div className="absolute top-2 left-2 z-20 bg-black/60 backdrop-blur-md p-1 rounded-md text-white">
                        <Film size={13} />
                      </div>
                    )}
                    <div className="absolute inset-0 z-20 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2 text-white text-xs">
                      <span className="truncate">{post.username}: {post.caption || "Medya"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Standard Posts Feed List */
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
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3
                        className="font-bold text-slate-800 dark:text-slate-200 text-[15px] leading-tight cursor-pointer hover:underline truncate"
                        onClick={() => onUserClick && onUserClick(post.user_id)}
                      >
                        {post.username}
                      </h3>
                      {post.subject && !activeSubject && (
                        <span className="text-[11px] px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium rounded-full truncate">
                          #{post.subject}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      {new Date(post.created_at).toLocaleString("tr-TR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Emirgan Moderation Menu */}
                    {currentUsername?.trim().toLowerCase() === 'emirgan' && post.username?.trim().toLowerCase() !== 'emirgan' && (
                      <AdminModerationMenu
                        targetUserId={post.user_id}
                        targetUsername={post.username}
                        currentUsername={currentUsername}
                        variant="dots"
                        onSuccess={() => {
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

                {/* PostMediaFrame: Aspect-Fit uncropped image/video with ambient blur backdrop */}
                {post.image && (
                  <div className="px-2 sm:px-4 pb-3">
                    <PostMediaFrame
                      src={post.image}
                      mediaType={post.media_type || "image"}
                      alt={post.caption || "Gönderi medyası"}
                      onClick={() => openPostModal(post)}
                    />
                  </div>
                )}

                {/* Action Bar */}
                <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between transition-colors duration-200">
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
        )}

        {/* Infinite Scroll Trigger & Manual Load More */}
        {hasMore && (
          <div ref={loadMoreRef} className="py-6 flex justify-center items-center">
            {isLoadingOlder ? (
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
                <Loader2 size={18} className="animate-spin text-blue-500" />
                <span>Daha eski gönderiler yükleniyor...</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={loadOlderPosts}
                className="px-5 py-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <ChevronDown size={14} />
                <span>Daha Fazla Gönderi Yükle</span>
              </button>
            )}
          </div>
        )}
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
