import { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import { Post, Story } from "../types";
import { Heart, MessageCircle, ImagePlus, Plus, Send } from "lucide-react";
import Avatar from "./Avatar";

export default function Feed({ socket, currentUserId, onUserClick }: { socket: Socket | null, currentUserId: number, onUserClick?: (id: number) => void }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  
  const [newPostCaption, setNewPostCaption] = useState("");
  const [newPostImage, setNewPostImage] = useState<File | null>(null);
  
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<number | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");

  useEffect(() => {
    if (!socket) return;
    const loadData = () => {
      socket.emit("get_feed", (data: Post[]) => setPosts(data));
      socket.emit("get_stories", (data: Story[]) => setStories(data));
    };
    loadData();
    socket.on("feed_updated", loadData);
    socket.on("stories_updated", loadData);
    
    return () => {
      socket.off("feed_updated", loadData);
      socket.off("stories_updated", loadData);
    };
  }, [socket]);

  useEffect(() => {
    if (activeCommentsPostId && socket) {
      socket.emit("get_comments", activeCommentsPostId, (data: any[]) => setComments(data));
      const onCommentsUpdated = (postId: number) => {
        if (postId === activeCommentsPostId) {
          socket.emit("get_comments", activeCommentsPostId, (data: any[]) => setComments(data));
        }
      };
      socket.on("comments_updated", onCommentsUpdated);
      return () => { socket.off("comments_updated", onCommentsUpdated); };
    }
  }, [activeCommentsPostId, socket]);

  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostCaption && !newPostImage) return;
    let imageUrl = null;
    if (newPostImage) {
      const formData = new FormData();
      formData.append("file", newPostImage);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        imageUrl = data.url;
      } catch (err) { console.error(err); return; }
    }
    socket?.emit("create_post", { image: imageUrl, caption: newPostCaption });
    setNewPostCaption("");
    setNewPostImage(null);
  };

  const handleStoryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !socket) return;
    const formData = new FormData();
    formData.append("file", e.target.files[0]);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      socket.emit("create_story", data.url);
    } catch (err) { console.error(err); }
    finally {
      e.target.value = '';
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

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="max-w-xl mx-auto pb-20">
        
        {/* Stories */}
        <div className="bg-white p-4 border-b border-slate-100 flex gap-4 overflow-x-auto shadow-sm sticky top-0 z-10 scrollbar-hide">
          <div className="flex flex-col items-center gap-1 min-w-[72px]">
            <div className="relative w-16 h-16 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-500 transition-colors">
              <Plus size={24} className="text-slate-400" />
              <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleStoryUpload} />
            </div>
            <span className="text-xs font-medium text-slate-500">Hikaye Ekle</span>
          </div>
          {stories.map(story => (
            <div key={story.id} className="flex flex-col items-center gap-1 min-w-[72px] cursor-pointer" onClick={() => onUserClick && onUserClick(story.user_id)}>
              <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-fuchsia-600">
                <img src={story.image} className="w-full h-full rounded-full object-cover border-2 border-white bg-white" />
              </div>
              <span className="text-xs font-medium text-slate-700 truncate w-full text-center hover:underline">{story.username}</span>
            </div>
          ))}
        </div>

        {/* Create Post */}
        <div className="bg-white p-4 my-4 shadow-sm border border-slate-100 md:rounded-2xl mx-0 md:mx-4 lg:mx-0">
          <form onSubmit={handlePostSubmit}>
            <textarea 
              placeholder="Ne düşünüyorsun?"
              className="w-full border-none focus:ring-0 resize-none mb-3 text-slate-700 placeholder-slate-400 outline-none p-2 text-lg"
              rows={2}
              value={newPostCaption}
              onChange={e => setNewPostCaption(e.target.value)}
            />
            {newPostImage && (
              <div className="relative mb-3">
                <img src={URL.createObjectURL(newPostImage)} className="rounded-xl max-h-64 object-cover" />
                <button type="button" onClick={() => setNewPostImage(null)} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 text-xs hover:bg-black/70 transition-colors">X</button>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-slate-50 pt-3">
              <label className="text-blue-500 hover:bg-blue-50 p-2 rounded-full cursor-pointer transition-colors flex items-center gap-2">
                <ImagePlus size={20} />
                <span className="text-sm font-medium">Fotoğraf</span>
                <input type="file" accept="image/*" className="hidden" onChange={e => setNewPostImage(e.target.files?.[0] || null)} />
              </label>
              <button 
                type="submit" 
                disabled={!newPostCaption && !newPostImage}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-full shadow-md transition-colors"
              >
                Paylaş
              </button>
            </div>
          </form>
        </div>

        {/* Posts */}
        <div className="space-y-4 md:px-0 mx-0 md:mx-4 lg:mx-0">
          {posts.map(post => (
            <div key={post.id} className="bg-white border-y md:border border-slate-100 md:rounded-2xl shadow-sm">
              <div className="p-4 flex items-center gap-3">
                <div className="cursor-pointer" onClick={() => onUserClick && onUserClick(post.user_id)}>
                  <Avatar url={post.avatar} name={post.username} color={post.color} size={10} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-[15px] leading-tight cursor-pointer hover:underline" onClick={() => onUserClick && onUserClick(post.user_id)}>{post.username}</h3>
                  <p className="text-xs text-slate-400">{new Date(post.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
                </div>
              </div>
              
              {post.caption && <p className="px-4 pb-3 text-slate-800 text-[15px]">{post.caption}</p>}
              {post.image && <img src={post.image} className="w-full max-h-[500px] object-cover bg-slate-50" />}
              
              <div className="px-4 py-3 border-t border-slate-50 flex items-center gap-6">
                <button onClick={() => handleLike(post.id)} className={`flex items-center gap-2 transition-colors ${post.is_liked ? 'text-red-500' : 'text-slate-500 hover:text-red-500'}`}>
                  <Heart size={22} fill={post.is_liked ? 'currentColor' : 'none'} />
                  <span className="font-medium text-sm">{post.likes_count}</span>
                </button>
                <button onClick={() => toggleComments(post.id)} className={`flex items-center gap-2 transition-colors ${activeCommentsPostId === post.id ? 'text-blue-500' : 'text-slate-500 hover:text-blue-500'}`}>
                  <MessageCircle size={22} />
                  <span className="font-medium text-sm">Yorum</span>
                </button>
              </div>

              {activeCommentsPostId === post.id && (
                <div className="border-t border-slate-100 bg-slate-50 p-4 rounded-b-2xl">
                  <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
                    {comments.length === 0 ? (
                      <p className="text-center text-xs text-slate-400 py-2">Henüz yorum yok. İlk yorumu sen yap!</p>
                    ) : (
                      comments.map(c => (
                        <div key={c.id} className="flex gap-2">
                           <div className="cursor-pointer" onClick={() => onUserClick && onUserClick(c.user_id)}>
                             <Avatar url={c.avatar} name={c.username} color={c.color} size={6} />
                           </div>
                           <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 flex-1">
                             <div className="font-semibold text-xs text-slate-800 cursor-pointer hover:underline inline-block" onClick={() => onUserClick && onUserClick(c.user_id)}>{c.username}</div>
                             <div className="text-sm text-slate-600 break-words">{c.content}</div>
                           </div>
                        </div>
                      ))
                    )}
                  </div>
                  <form onSubmit={handleAddComment} className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Yorum ekle..." 
                      className="flex-1 rounded-full border-none shadow-sm px-4 py-2 focus:ring-2 focus:ring-blue-500 text-sm outline-none"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                    />
                    <button type="submit" disabled={!newComment.trim()} className="bg-blue-600 text-white rounded-full p-2 disabled:opacity-50 hover:bg-blue-700 transition-colors shadow-sm">
                      <Send size={16} />
                    </button>
                  </form>
                </div>
              )}
            </div>
          ))}
          
          {posts.length === 0 && (
            <div className="p-8 text-center text-slate-400 bg-white md:rounded-2xl border-y md:border border-slate-100 shadow-sm">
              Henüz gönderi yok.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
