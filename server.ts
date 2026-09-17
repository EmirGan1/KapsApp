import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";
import bcrypt from "bcryptjs";
import multer from "multer";
import crypto from "crypto";
import fs from "fs";
import os from "os";

// Ensure uploads dir
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads", { recursive: true });
}

// Multer Config
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// JSON Database Logic
const DB_FILE = "lan-social.json";
const defaultDb = {
  users: [] as any[],
  friends: [] as any[],
  posts: [] as any[],
  likes: [] as any[],
  comments: [] as any[],
  stories: [] as any[],
  messages: [] as any[],
  global_messages: [] as any[],
  groups: [] as any[],
  group_messages: [] as any[],
  notifications: [] as any[]
};
let db = defaultDb;
if (fs.existsSync(DB_FILE)) {
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
    db = { ...defaultDb, ...parsed };
    if (!db.notifications) db.notifications = [];
  } catch (e) {
    db = defaultDb;
  }
}
const saveDb = () => fs.writeFileSync(DB_FILE, JSON.stringify(db));
const getNextId = (table: string) => {
  const arr = db[table as keyof typeof db] || [];
  return arr.length ? Math.max(...arr.map((x: any) => x.id || 0)) + 1 : 1;
};

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json());
  app.use("/uploads", express.static("uploads"));

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    maxHttpBufferSize: 1e8 // 100 MB for large payloads
  });

  // REST API Routes
  app.post("/api/register", async (req, res) => {
    const { username, password } = req.body;
    if (db.users.find(u => u.username === username)) {
      return res.status(400).json({ error: "Kullanıcı adı alınmış olabilir." });
    }
    const hash = await bcrypt.hash(password, 10);
    const token = crypto.randomUUID();
    
    // Get initials for the new user
    let initials = "?";
    const parts = username.trim().split(" ");
    if (parts.length > 1) {
      initials = (parts[0][0] + parts[1][0]).toUpperCase();
    } else {
      initials = username.substring(0, 2).toUpperCase();
    }

    // Find used colors by users with the same initials
    const usedColors = new Set(
      db.users.filter(u => {
        let uInit = "?";
        const p = u.username.trim().split(" ");
        if (p.length > 1) uInit = (p[0][0] + p[1][0]).toUpperCase();
        else uInit = u.username.substring(0, 2).toUpperCase();
        return uInit === initials;
      }).map(u => u.color)
    );

    const colors = ["bg-red-500", "bg-blue-500", "bg-green-500", "bg-yellow-500", "bg-purple-500", "bg-pink-500", "bg-indigo-500", "bg-teal-500"];
    const availableColors = colors.filter(c => !usedColors.has(c));
    const randomColor = availableColors.length > 0 
      ? availableColors[Math.floor(Math.random() * availableColors.length)]
      : colors[Math.floor(Math.random() * colors.length)]; // Fallback if all colors used

    const newUser = { id: getNextId("users"), username, password: hash, avatar: null, color: randomColor, token, last_seen: new Date().toISOString() };
    db.users.push(newUser);
    saveDb();
    res.json({ token, username, id: newUser.id, color: randomColor });
  });

  app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    const user = db.users.find(u => u.username === username);
    if (user && await bcrypt.compare(password, user.password)) {
      const token = crypto.randomUUID();
      user.token = token;
      if (!user.color) {
        const colors = ["bg-red-500", "bg-blue-500", "bg-green-500", "bg-yellow-500", "bg-purple-500", "bg-pink-500", "bg-indigo-500", "bg-teal-500"];
        user.color = colors[Math.floor(Math.random() * colors.length)];
      }
      saveDb();
      res.json({ token, username, avatar: user.avatar, id: user.id, color: user.color });
    } else {
      res.status(401).json({ error: "Geçersiz giriş." });
    }
  });

  app.post("/api/upload", upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file" });
    res.json({ url: `/uploads/${req.file.filename}` });
  });

  // Socket Online Tracking
  const onlineUsers = new Map();
  const globalRead = new Map<number, number>();
  const chatRead = new Map<number, Map<number, number>>();

  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("No token"));
    const user = db.users.find(u => u.token === token);
    if (!user) return next(new Error("Invalid token"));
    socket.data.user = user;
    next();
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;
    onlineUsers.set(user.id, socket.id);
    socket.emit("your_id", user.id);
    io.emit("online_users", Array.from(onlineUsers.keys()));

    const getUser = (id: number) => db.users.find(u => u.id === id);

    socket.on("mark_global_read", (messageId) => {
      globalRead.set(user.id, messageId);
      io.emit("global_read_update", Array.from(globalRead.entries()));
    });
    
    socket.on("get_global_read", (cb) => {
      cb(Array.from(globalRead.entries()));
    });

    socket.on("mark_chat_read", (chatId, messageId) => {
      if(!chatRead.has(chatId)) chatRead.set(chatId, new Map());
      chatRead.get(chatId)!.set(user.id, messageId);
      io.emit("chat_read_update", chatId, Array.from(chatRead.get(chatId)!.entries()));
    });

    socket.on("get_chat_read", (chatId, cb) => {
      if(!chatRead.has(chatId)) return cb([]);
      cb(Array.from(chatRead.get(chatId)!.entries()));
    });

    socket.on("get_user_profile", async (targetId, cb) => {
      const u = getUser(targetId);
      if (u) {
        cb({ id: u.id, username: u.username, avatar: u.avatar, color: u.color });
      } else {
        cb(null);
      }
    });

    socket.on("get_user_posts", async (targetId, cb) => {
      const posts = db.posts.filter(p => p.user_id === targetId).map(p => {
        const pUser = getUser(p.user_id);
        const likes_count = db.likes.filter(l => l.post_id === p.id).length;
        const is_liked = db.likes.some(l => l.post_id === p.id && l.user_id === user.id);
        return { ...p, username: pUser?.username, avatar: pUser?.avatar, color: pUser?.color, likes_count, is_liked };
      }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      cb(posts);
    });

    // Feeds
    socket.on("get_feed", async (cb) => {
      const posts = db.posts.map(p => {
        const pUser = getUser(p.user_id);
        const likes_count = db.likes.filter(l => l.post_id === p.id).length;
        const is_liked = db.likes.some(l => l.post_id === p.id && l.user_id === user.id);
        return { ...p, username: pUser?.username, avatar: pUser?.avatar, color: pUser?.color, likes_count, is_liked };
      }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      cb(posts);
    });

    socket.on("create_post", async (data, cb) => {
      db.posts.push({ id: getNextId("posts"), user_id: user.id, image: data.image, caption: data.caption, created_at: new Date().toISOString() });
      saveDb();
      io.emit("feed_updated");
      if(cb) cb();
    });

    socket.on("like_post", async (postId) => {
      const idx = db.likes.findIndex(l => l.post_id === postId && l.user_id === user.id);
      if (idx !== -1) db.likes.splice(idx, 1);
      else db.likes.push({ post_id: postId, user_id: user.id });
      saveDb();
      io.emit("feed_updated");
    });

    socket.on("get_comments", async (postId, cb) => {
      const comments = db.comments.filter(c => c.post_id === postId).map(c => {
        const cUser = getUser(c.user_id);
        return { ...c, username: cUser?.username, avatar: cUser?.avatar, color: cUser?.color };
      }).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      cb(comments);
    });

    socket.on("add_comment", async (data) => {
      db.comments.push({ id: getNextId("comments"), post_id: data.postId, user_id: user.id, content: data.content, created_at: new Date().toISOString() });
      saveDb();
      io.emit("feed_updated");
      io.emit("comments_updated", data.postId);
    });

    // Stories (last 24 hours)
    socket.on("get_stories", async (cb) => {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const stories = db.stories.filter(s => new Date(s.created_at) >= oneDayAgo).map(s => {
        const sUser = getUser(s.user_id);
        return { ...s, username: sUser?.username, avatar: sUser?.avatar, color: sUser?.color };
      }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      cb(stories);
    });
    
    socket.on("create_story", async (image, cb) => {
      db.stories.push({ id: getNextId("stories"), user_id: user.id, image, created_at: new Date().toISOString() });
      saveDb();
      io.emit("stories_updated");
      if(cb) cb();
    });

    const addNotification = (userId: number, type: string, content: string) => {
      if (userId === user.id) return;
      const notif = { id: getNextId("notifications"), user_id: userId, type, content, read: false, created_at: new Date().toISOString() };
      db.notifications.push(notif);
      saveDb();
      const s = onlineUsers.get(userId);
      if (s) io.to(s).emit("new_notification", notif);
    };

    socket.on("get_notifications", (cb) => {
      const notifs = db.notifications.filter((n: any) => n.user_id === user.id).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      cb(notifs);
    });

    socket.on("mark_notifications_read", () => {
      let changed = false;
      db.notifications.forEach((n: any) => {
        if (n.user_id === user.id && !n.read) {
          n.read = true;
          changed = true;
        }
      });
      if (changed) saveDb();
    });

    // Friends
    socket.on("get_friends", async (cb) => {
      const myFriends = db.friends.filter(f => f.user1 === user.id || f.user2 === user.id);
      const result = myFriends.map(f => {
        const otherId = f.user1 === user.id ? f.user2 : f.user1;
        const otherUser = getUser(otherId);
        return {
          id: otherUser?.id,
          username: otherUser?.username,
          avatar: otherUser?.avatar,
          status: f.status,
          is_sender: f.user1 === user.id
        };
      }).filter(x => x.id);
      cb(result);
    });

    socket.on("search_users", async (query, cb) => {
      if(!query) return cb([]);
      const users = db.users.filter(u => u.id !== user.id && u.username.toLowerCase().includes(query.toLowerCase())).slice(0, 20);
      cb(users.map(u => ({ id: u.id, username: u.username, avatar: u.avatar })));
    });

    socket.on("add_friend", async (targetId, cb) => {
      const existing = db.friends.find(f => (f.user1 === user.id && f.user2 === targetId) || (f.user1 === targetId && f.user2 === user.id));
      if (!existing) {
        db.friends.push({ user1: user.id, user2: targetId, status: 0 });
        saveDb();
        const targetSocket = onlineUsers.get(targetId);
        if (targetSocket) io.to(targetSocket).emit("friends_updated");
        addNotification(targetId, "friend_request", `${user.username} sana arkadaşlık isteği gönderdi.`);
      }
      if(cb) cb();
    });

    socket.on("accept_friend", async (targetId, cb) => {
      const friend = db.friends.find(f => f.user1 === targetId && f.user2 === user.id);
      if (friend) {
        friend.status = 1;
        saveDb();
        const targetSocket = onlineUsers.get(targetId);
        if (targetSocket) io.to(targetSocket).emit("friends_updated");
        addNotification(targetId, "friend_accept", `${user.username} arkadaşlık isteğini kabul etti.`);
      }
      if(cb) cb();
    });

    socket.on("get_all_users", async (cb) => {
      const users = db.users.map(u => ({ id: u.id, username: u.username, avatar: u.avatar, color: u.color }));
      cb(users);
    });

    // Chat
    socket.on("get_messages", async (friendId, cb) => {
      const messages = db.messages.filter(m => (m.sender === user.id && m.receiver === friendId) || (m.sender === friendId && m.receiver === user.id))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      cb(messages);
    });

    socket.on("send_message", async (data) => {
      const { receiver, type, content, reply_to } = data;
      const newMsg = { id: getNextId("messages"), sender: user.id, receiver, type, content, reply_to, reactions: [], created_at: new Date().toISOString() };
      db.messages.push(newMsg);
      saveDb();
      
      const targetSocket = onlineUsers.get(receiver);
      if (targetSocket) io.to(targetSocket).emit("new_message", newMsg);
      socket.emit("new_message", newMsg); // echo back
      addNotification(receiver, "new_message", `${user.username} sana yeni bir mesaj gönderdi.`);
    });

    const populateMessage = (m: any) => {
      const sUser = getUser(m.sender);
      let replyMsg = null;
      if (m.reply_to) {
         // Figure out which table to look at
         let sourceTbl = db.messages;
         if (m.group_id) sourceTbl = db.group_messages;
         else if (db.global_messages.some(gm => gm.id === m.id)) sourceTbl = db.global_messages;
         const refMsg = sourceTbl.find((x: any) => x.id === m.reply_to);
         if (refMsg) {
           const refUser = getUser(refMsg.sender);
           replyMsg = { ...refMsg, sender_name: refUser?.username };
         }
      }
      return { ...m, sender_name: sUser?.username, sender_avatar: sUser?.avatar, sender_color: sUser?.color, reply_message: replyMsg };
    };

    // Global Chat
    socket.on("get_global_messages", async (cb) => {
      cb(db.global_messages.slice(-100).map(populateMessage));
    });

    socket.on("send_global_message", async (data) => {
      const { type, content, reply_to } = data;
      const newMsg = { id: getNextId("global_messages"), sender: user.id, type, content, reply_to, reactions: [], created_at: new Date().toISOString() };
      db.global_messages.push(newMsg);
      saveDb();
      io.emit("new_global_message", populateMessage(newMsg));
    });

    // Groups
    socket.on("get_groups", async (cb) => {
      const myGroups = db.groups.filter(g => g.members.includes(user.id));
      cb(myGroups);
    });

    socket.on("create_group", async (data, cb) => {
      const { name, members } = data; 
      const allMembers = [user.id, ...members];
      const newGroup = { id: getNextId("groups"), name, creator: user.id, members: allMembers, created_at: new Date().toISOString() };
      db.groups.push(newGroup);
      saveDb();
      allMembers.forEach((memberId: number) => {
        const targetSocket = onlineUsers.get(memberId);
        if (targetSocket) io.to(targetSocket).emit("groups_updated");
        addNotification(memberId, "group_invite", `${user.username} seni ${name} grubuna ekledi.`);
      });
      if(cb) cb(newGroup);
    });

    socket.on("get_group_messages", async (groupId, cb) => {
      const messages = db.group_messages.filter(m => m.group_id === groupId)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map(populateMessage);
      cb(messages);
    });

    socket.on("send_group_message", async (data) => {
      const { group_id, type, content, reply_to } = data;
      const newMsg = { id: getNextId("group_messages"), group_id, sender: user.id, type, content, reply_to, reactions: [], created_at: new Date().toISOString() };
      db.group_messages.push(newMsg);
      saveDb();
      
      const group = db.groups.find(g => g.id === group_id);
      if (group) {
        const popMsg = populateMessage(newMsg);
        group.members.forEach((memberId: number) => {
          const targetSocket = onlineUsers.get(memberId);
          if (targetSocket) io.to(targetSocket).emit("new_group_message", popMsg);
          addNotification(memberId, "new_group_message", `${group.name} grubuna yeni bir mesaj geldi.`);
        });
      }
    });

    socket.on("typing", (data) => {
      // data: { type: 'global' | 'group' | 'private', receiver?: number, group_id?: number }
      if (data.type === 'private') {
        const targetSocket = onlineUsers.get(data.receiver);
        if (targetSocket) io.to(targetSocket).emit("user_typing", { type: 'private', sender: user.id });
      } else if (data.type === 'group') {
        const group = db.groups.find((g: any) => g.id === data.group_id);
        if (group) {
          group.members.forEach((memberId: number) => {
            if (memberId !== user.id) {
              const targetSocket = onlineUsers.get(memberId);
              if (targetSocket) io.to(targetSocket).emit("user_typing", { type: 'group', group_id: data.group_id, sender: user.id });
            }
          });
        }
      } else if (data.type === 'global') {
        socket.broadcast.emit("user_typing", { type: 'global', sender: user.id });
      }
    });

    socket.on("react_message", (data) => {
       // data: { type: 'private' | 'group' | 'global', message_id, emoji }
       let msgList;
       if (data.type === 'private') msgList = db.messages;
       else if (data.type === 'group') msgList = db.group_messages;
       else if (data.type === 'global') msgList = db.global_messages;
       
       if (msgList) {
         const msg = msgList.find((m: any) => m.id === data.message_id);
         if (msg) {
           if (!msg.reactions) msg.reactions = [];
           const existingIdx = msg.reactions.findIndex((r: any) => r.user_id === user.id && r.emoji === data.emoji);
           if (existingIdx > -1) {
             msg.reactions.splice(existingIdx, 1);
           } else {
             msg.reactions.push({ user_id: user.id, emoji: data.emoji });
           }
           saveDb();
           io.emit("message_reacted", { type: data.type, message_id: data.message_id, reactions: msg.reactions });
         }
       }
    });

    socket.on("update_avatar", async (url) => {
      const u = getUser(user.id);
      if (u) {
        u.avatar = url;
        saveDb();
        io.emit("feed_updated");
        io.emit("friends_updated");
      }
    });

    socket.on("disconnect", async () => {
      const u = getUser(user.id);
      if (u) {
        u.last_seen = new Date().toISOString();
        saveDb();
      }
      onlineUsers.delete(user.id);
      io.emit("online_users", Array.from(onlineUsers.keys()));
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  // Get local IP
  const getLocalIP = () => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === "IPv4" && !iface.internal) return iface.address;
      }
    }
    return "localhost";
  };

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`\n=====================================`);
    console.log(`✅ Server running on LAN`);
    console.log(`➡️  Connect via: http://${getLocalIP()}:${PORT}`);
    console.log(`=====================================\n`);
  });
}

startServer();
