import React, { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import { Post, Story, MediaModalData } from "../types";
import { Heart, MessageCircle, ImagePlus, Plus, Send, Film, Maximize2 } from "lucide-react";
import Avatar from "./Avatar";
import MediaModal from "./MediaModal";

export default function Feed({
  socket,
  currentUserId,
  onUserClick,
  activeSubject
}: {
  socket: Socket | null;
  currentUserId: number;
  onUserClick?: (id: number) => void;
  activeSubject?: string | null;
}) {
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
    if (!socket) return;
    const loadData = () => {
      socket.emit("get_feed", activeSubject || null, (data: Post[]) => setPosts(data));
      socket.emit("get_stories", (data: Story[]) => setStories(data));
    };
    loadData();
    socket.on("feed_updated", loadData);
    socket.on("stories_updated", loadData);

    return () => {
      socket.off("feed_updated", loadData);
      socket.off("stories_updated", loadData);
    };
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

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewPostMedia(file);
    if (file.type.startsWith("video/")) {
      setNewPostMediaType("video");
    } else {
      setNewPostMediaType("image");
    }
  };

  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostCaption && !newPostMedia) return;
    setIsSubmitting(true);
    let mediaUrl = null;
    let finalMediaType = newPostMediaType;

    if (newPostMedia) {
      const formData = new FormData();
      formData.append("file", newPostMedia);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        mediaUrl = data.url;
        if (data.media_type === "video") finalMediaType = "video";
      } catch (err) {
        console.error(err);
        setIsSubmitting(false);
        return;
      }
    }

    socket?.emit("create_post", {
      image: mediaUrl,
      media_type: finalMediaType,
      caption: newPostCaption,
      subject: activeSubject || null
    });

    setNewPostCaption("");
    setNewPostMedia(null);
    setIsSubmitting(false);
  };

  const handleStoryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !socket) return;
    const formData = new FormData();
    formData.append("file", e.target.files[0]);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      socket.emit("create_story", data.url);
    } catch (err) {
      console.error(err);
    } finally {
      e.target.value = "";
    }
  };

  const handleLike = (postId: number) => {
    socket?.emit("like_post", postId);
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
              placeholder="Ne düşünüyorsun? Fotoğraf veya video paylaş..."
              className="w-full bg-transparent border-none focus:ring-0 resize-none mb-3 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none p-2 text-base md:text-lg"
              rows={2}
              value={newPostCaption}
              onChange={(e) => setNewPostCaption(e.target.value)}
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
                disabled={(!newPostCaption && !newPostMedia) || isSubmitting}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-full shadow-md transition-colors cursor-pointer"
              >
                {isSubmitting ? "Yükleniyor..." : "Paylaş"}
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
              </div>

              {/* Caption */}
              {post.caption && (
                <p className="px-4 pb-3 text-slate-800 dark:text-slate-200 text-[15px] leading-relaxed whitespace-pre-wrap">
                  {post.caption}
                </p>
              )}

              {/* Media (Image or Video) with Instagram Lightbox Trigger */}
              {post.image && (
                <div className="relative group bg-slate-900 overflow-hidden cursor-pointer">
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
                      className="w-full max-h-[500px] object-cover bg-slate-50 transition-transform duration-300 group-hover:scale-[1.01]"
                      onClick={() => openPostModal(post)}
                    />
                  )}

                  {/* Expand button (Instagram style trigger) */}
                  <button
                    onClick={() => openPostModal(post)}
                    className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                    title="Büyüt ve Bilgileri Gör"
                  >
                    <Maximize2 size={16} />
                  </button>
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
                          <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex-1 transition-colors duration-200">
                            <div
                              className="font-semibold text-xs text-slate-800 dark:text-slate-200 cursor-pointer hover:underline inline-block"
                              onClick={() => onUserClick && onUserClick(c.user_id)}
                            >
                              {c.username}
                            </div>
                            <div className="text-sm text-slate-600 dark:text-slate-300 break-words leading-relaxed">
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
