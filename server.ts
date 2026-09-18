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
import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config();

// Ensure uploads dir
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer Config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + ext);
  },
});
const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100 MB limit for videos and files
});

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || process.env.LIBSQL_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN,
});

async function initDb() {
  await client.execute(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    avatar TEXT,
    color TEXT,
    token TEXT,
    last_seen TEXT
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS friends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user1 INTEGER,
    user2 INTEGER,
    status INTEGER
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    image TEXT,
    caption TEXT,
    created_at TEXT
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    user_id INTEGER
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    user_id INTEGER,
    content TEXT,
    created_at TEXT
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS stories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    image TEXT,
    created_at TEXT
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender INTEGER,
    receiver INTEGER,
    type TEXT,
    content TEXT,
    reply_to INTEGER,
    reactions TEXT,
    created_at TEXT
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS global_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender INTEGER,
    type TEXT,
    content TEXT,
    reply_to INTEGER,
    reactions TEXT,
    created_at TEXT
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    creator INTEGER,
    members TEXT,
    created_at TEXT
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS group_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER,
    sender INTEGER,
    type TEXT,
    content TEXT,
    reply_to INTEGER,
    reactions TEXT,
    created_at TEXT
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT,
    content TEXT,
    read INTEGER DEFAULT 0,
    created_at TEXT
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS uploaded_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT UNIQUE,
    original_name TEXT,
    mimetype TEXT,
    size INTEGER,
    data TEXT,
    created_at TEXT
  )`);

  // Migrations for existing tables
  try { await client.execute("ALTER TABLE messages ADD COLUMN file_name TEXT"); } catch(e){}
  try { await client.execute("ALTER TABLE messages ADD COLUMN file_size TEXT"); } catch(e){}
  try { await client.execute("ALTER TABLE group_messages ADD COLUMN file_name TEXT"); } catch(e){}
  try { await client.execute("ALTER TABLE group_messages ADD COLUMN file_size TEXT"); } catch(e){}
  try { await client.execute("ALTER TABLE global_messages ADD COLUMN file_name TEXT"); } catch(e){}
  try { await client.execute("ALTER TABLE global_messages ADD COLUMN file_size TEXT"); } catch(e){}
  try { await client.execute("ALTER TABLE posts ADD COLUMN media_type TEXT"); } catch(e){}
}

async function startServer() {
  await initDb();
  
  const app = express();
  const PORT = 3000;
  
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Explicit /uploads/:filename serving with Turso cloud fallback (Render restarts won't break media!)
  app.get("/uploads/:filename", async (req, res) => {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(uploadsDir, filename);

    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }

    try {
      const fileRes = await client.execute({
        sql: "SELECT original_name, mimetype, data FROM uploaded_files WHERE filename = ?",
        args: [filename]
      });
      if (fileRes.rows.length > 0) {
        const row = fileRes.rows[0];
        const buffer = Buffer.from(row.data as string, "base64");
        try {
          fs.writeFileSync(filePath, buffer);
        } catch (e) {
          console.error("Cache write error:", e);
        }
        if (row.mimetype) {
          res.setHeader("Content-Type", row.mimetype as string);
        }
        return res.send(buffer);
      }
    } catch (err) {
      console.error("Error restoring file from cloud DB:", err);
    }

    // Never fall through to Vite SPA index.html for uploads!
    return res.status(404).send("File not found");
  });

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    maxHttpBufferSize: 1e8 // 100 MB for large payloads
  });

  // REST API Routes
  app.post("/api/register", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Eksik bilgi." });
      }
      
      const existing = await client.execute({
        sql: "SELECT id FROM users WHERE username = ?",
        args: [username]
      });
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: "Kullanıcı adı alınmış olabilir." });
      }
      
      const hash = await bcrypt.hash(password, 10);
      const token = crypto.randomUUID();
      
      let initials = "?";
      const parts = username.trim().split(/\s+/);
      if (parts.length > 1 && parts[0].length > 0 && parts[1].length > 0) {
        initials = (parts[0][0] + parts[1][0]).toUpperCase();
      } else {
        initials = username.substring(0, 2).toUpperCase();
      }

      const allUsers = await client.execute("SELECT username, color FROM users");
      const usedColors = new Set(
        allUsers.rows.filter(u => {
          let uInit = "?";
          if (u.username) {
            const p = (u.username as string).trim().split(/\s+/);
            if (p.length > 1 && p[0].length > 0 && p[1].length > 0) uInit = (p[0][0] + p[1][0]).toUpperCase();
            else uInit = (u.username as string).substring(0, 2).toUpperCase();
          }
          return uInit === initials;
        }).map(u => u.color)
      );

      const colors = ["bg-red-500", "bg-blue-500", "bg-green-500", "bg-yellow-500", "bg-purple-500", "bg-pink-500", "bg-indigo-500", "bg-teal-500"];
      const availableColors = colors.filter(c => !usedColors.has(c));
      const randomColor = availableColors.length > 0 
        ? availableColors[Math.floor(Math.random() * availableColors.length)]
        : colors[Math.floor(Math.random() * colors.length)]; // Fallback if all colors used

      const lastSeen = new Date().toISOString();
      const insertResult = await client.execute({
        sql: "INSERT INTO users (username, password, color, token, last_seen) VALUES (?, ?, ?, ?, ?)",
        args: [username, hash, randomColor, token, lastSeen]
      });
      
      res.json({ token, username, id: Number(insertResult.lastInsertRowid), color: randomColor });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const userRes = await client.execute({
        sql: "SELECT * FROM users WHERE username = ?",
        args: [username]
      });
      
      if (userRes.rows.length > 0) {
        const user = userRes.rows[0];
        if (await bcrypt.compare(password, user.password as string)) {
          const token = crypto.randomUUID();
          let color = user.color;
          if (!color) {
            const colors = ["bg-red-500", "bg-blue-500", "bg-green-500", "bg-yellow-500", "bg-purple-500", "bg-pink-500", "bg-indigo-500", "bg-teal-500"];
            color = colors[Math.floor(Math.random() * colors.length)];
          }
          await client.execute({
            sql: "UPDATE users SET token = ?, color = ? WHERE id = ?",
            args: [token, color, user.id]
          });
          res.json({ token, username: user.username, avatar: user.avatar, id: user.id, color });
        } else {
          res.status(401).json({ error: "Geçersiz giriş." });
        }
      } else {
        res.status(401).json({ error: "Geçersiz giriş." });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/upload", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Dosya bulunamadı." });

    const filename = req.file.filename;
    const originalName = req.file.originalname;
    const mimetype = req.file.mimetype;
    const size = req.file.size;
    const filePath = req.file.path;
    const url = `/uploads/${filename}`;

    // Persistent backup to Turso cloud database (so Render container restarts don't wipe files)
    try {
      if (size <= 25 * 1024 * 1024) {
        const base64 = fs.readFileSync(filePath).toString("base64");
        await client.execute({
          sql: "INSERT OR REPLACE INTO uploaded_files (filename, original_name, mimetype, size, data, created_at) VALUES (?, ?, ?, ?, ?, ?)",
          args: [filename, originalName, mimetype, size, base64, new Date().toISOString()]
        });
      }
    } catch (err) {
      console.error("Cloud file backup error:", err);
    }

    const isVideo = mimetype.startsWith("video/") || /\.(mp4|webm|mov|mkv|avi)$/i.test(originalName);
    const isImage = mimetype.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(originalName);
    const isAudio = mimetype.startsWith("audio/") || /\.(webm|mp3|ogg|wav)$/i.test(originalName);

    res.json({
      url,
      filename,
      original_name: originalName,
      mimetype,
      size,
      media_type: isVideo ? "video" : isImage ? "image" : isAudio ? "voice" : "file"
    });
  });

  // Socket Online Tracking
  const onlineUsers = new Map();
  const globalRead = new Map<number, number>();
  const chatRead = new Map<number, Map<number, number>>();

  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("No token"));
    
    try {
      const userRes = await client.execute({
        sql: "SELECT * FROM users WHERE token = ?",
        args: [token]
      });
      if (userRes.rows.length === 0) return next(new Error("Invalid token"));
      socket.data.user = userRes.rows[0];
      next();
    } catch(e) {
      next(new Error("DB error"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;
    onlineUsers.set(Number(user.id), socket.id);
    socket.emit("your_id", Number(user.id));
    io.emit("online_users", Array.from(onlineUsers.keys()));

    const getUser = async (id: number) => {
      const res = await client.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [id] });
      return res.rows.length > 0 ? res.rows[0] : null;
    };

    socket.on("mark_global_read", (messageId) => {
      globalRead.set(Number(user.id), messageId);
      io.emit("global_read_update", Array.from(globalRead.entries()));
    });
    
    socket.on("get_global_read", (cb) => {
      cb(Array.from(globalRead.entries()));
    });

    socket.on("mark_chat_read", (chatId, messageId) => {
      if(!chatRead.has(chatId)) chatRead.set(chatId, new Map());
      chatRead.get(chatId)!.set(Number(user.id), messageId);
      io.emit("chat_read_update", chatId, Array.from(chatRead.get(chatId)!.entries()));
    });

    socket.on("get_chat_read", (chatId, cb) => {
      if(!chatRead.has(chatId)) return cb([]);
      cb(Array.from(chatRead.get(chatId)!.entries()));
    });

    socket.on("get_user_profile", async (targetId, cb) => {
      const u = await getUser(targetId);
      if (u) {
        cb({ id: u.id, username: u.username, avatar: u.avatar, color: u.color });
      } else {
        cb(null);
      }
    });

    socket.on("get_user_posts", async (targetId, cb) => {
      try {
        const postsRes = await client.execute({ sql: "SELECT * FROM posts WHERE user_id = ? ORDER BY created_at DESC", args: [targetId] });
        const likesRes = await client.execute("SELECT * FROM likes");
        const commentsRes = await client.execute("SELECT * FROM comments");
        
        const populated = await Promise.all(postsRes.rows.map(async (p: any) => {
          const pUser = await getUser(p.user_id as number);
          const postLikes = likesRes.rows.filter(l => l.post_id === p.id);
          const postComments = await Promise.all(commentsRes.rows.filter(c => c.post_id === p.id).map(async (c: any) => {
            const cu = await getUser(c.user_id as number);
            return { ...c, username: cu?.username, user_avatar: cu?.avatar, user_color: cu?.color };
          }));
          const is_liked = postLikes.some(l => l.user_id === user.id);
          const ext = (p.image as string || "").split(".").pop()?.toLowerCase();
          const media_type = p.media_type || (["mp4", "webm", "mov", "mkv", "avi"].includes(ext || "") ? "video" : "image");
          return { 
            ...p, 
            media_type,
            username: pUser?.username, 
            user_avatar: pUser?.avatar, 
            user_color: pUser?.color, 
            avatar: pUser?.avatar, 
            color: pUser?.color, 
            likes_count: postLikes.length, 
            is_liked, 
            likes: postLikes, 
            comments: postComments 
          };
        }));
        cb(populated);
      } catch(e) {
        console.error(e);
        cb([]);
      }
    });

    // Feeds
    socket.on("get_feed", async (cb) => {
      try {
        const postsRes = await client.execute("SELECT * FROM posts ORDER BY created_at DESC");
        const likesRes = await client.execute("SELECT * FROM likes");
        const populated = await Promise.all(postsRes.rows.map(async (p: any) => {
          const pUser = await getUser(p.user_id as number);
          const postLikes = likesRes.rows.filter(l => l.post_id === p.id);
          const is_liked = postLikes.some(l => l.user_id === user.id);
          const ext = (p.image as string || "").split(".").pop()?.toLowerCase();
          const media_type = p.media_type || (["mp4", "webm", "mov", "mkv", "avi"].includes(ext || "") ? "video" : "image");
          return { 
            ...p, 
            media_type,
            username: pUser?.username, 
            avatar: pUser?.avatar, 
            color: pUser?.color, 
            likes_count: postLikes.length, 
            is_liked 
          };
        }));
        cb(populated);
      } catch(e) {
        cb([]);
      }
    });

    socket.on("create_post", async (data, cb) => {
      let mediaType = data.media_type;
      if (!mediaType && data.image) {
        const ext = data.image.split(".").pop()?.toLowerCase();
        mediaType = ["mp4", "webm", "mov", "mkv", "avi"].includes(ext || "") ? "video" : "image";
      }
      await client.execute({
        sql: "INSERT INTO posts (user_id, image, caption, media_type, created_at) VALUES (?, ?, ?, ?, ?)",
        args: [user.id, data.image, data.caption, mediaType || "image", new Date().toISOString()]
      });
      io.emit("feed_updated");
      if(cb) cb();
    });

    socket.on("like_post", async (postId) => {
      const existing = await client.execute({
        sql: "SELECT id FROM likes WHERE post_id = ? AND user_id = ?",
        args: [postId, user.id]
      });
      if (existing.rows.length > 0) {
        await client.execute({
          sql: "DELETE FROM likes WHERE id = ?",
          args: [existing.rows[0].id]
        });
      } else {
        await client.execute({
          sql: "INSERT INTO likes (post_id, user_id) VALUES (?, ?)",
          args: [postId, user.id]
        });
      }
      io.emit("feed_updated");
    });

    socket.on("get_comments", async (postId, cb) => {
      const commentsRes = await client.execute({
        sql: "SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC",
        args: [postId]
      });
      const populated = await Promise.all(commentsRes.rows.map(async (c: any) => {
        const cUser = await getUser(c.user_id as number);
        return { ...c, username: cUser?.username, avatar: cUser?.avatar, color: cUser?.color };
      }));
      cb(populated);
    });

    socket.on("add_comment", async (data) => {
      await client.execute({
        sql: "INSERT INTO comments (post_id, user_id, content, created_at) VALUES (?, ?, ?, ?)",
        args: [data.postId, user.id, data.content, new Date().toISOString()]
      });
      io.emit("feed_updated");
      io.emit("comments_updated", data.postId);
    });

    // Stories (last 24 hours)
    socket.on("get_stories", async (cb) => {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const storiesRes = await client.execute({
        sql: "SELECT * FROM stories WHERE created_at >= ? ORDER BY created_at DESC",
        args: [oneDayAgo]
      });
      const populated = await Promise.all(storiesRes.rows.map(async (s: any) => {
        const sUser = await getUser(s.user_id as number);
        return { ...s, username: sUser?.username, avatar: sUser?.avatar, color: sUser?.color };
      }));
      cb(populated);
    });
    
    socket.on("create_story", async (image, cb) => {
      await client.execute({
        sql: "INSERT INTO stories (user_id, image, created_at) VALUES (?, ?, ?)",
        args: [user.id, image, new Date().toISOString()]
      });
      io.emit("stories_updated");
      if(cb) cb();
    });

    const addNotification = async (userId: number, type: string, content: string) => {
      if (userId === user.id) return;
      const res = await client.execute({
        sql: "INSERT INTO notifications (user_id, type, content, read, created_at) VALUES (?, ?, ?, 0, ?)",
        args: [userId, type, content, new Date().toISOString()]
      });
      const newNotifRes = await client.execute({ sql: "SELECT * FROM notifications WHERE id = ?", args: [Number(res.lastInsertRowid)] });
      const s = onlineUsers.get(userId);
      if (s) io.to(s).emit("new_notification", newNotifRes.rows[0]);
    };

    socket.on("get_notifications", async (cb) => {
      const notifsRes = await client.execute({
        sql: "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC",
        args: [user.id]
      });
      cb(notifsRes.rows);
    });

    socket.on("mark_notifications_read", async () => {
      await client.execute({
        sql: "UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0",
        args: [user.id]
      });
    });

    // Friends
    socket.on("get_friends", async (cb) => {
      const friendsRes = await client.execute({
        sql: "SELECT * FROM friends WHERE user1 = ? OR user2 = ?",
        args: [user.id, user.id]
      });
      const result = await Promise.all(friendsRes.rows.map(async (f: any) => {
        const otherId = f.user1 === user.id ? f.user2 : f.user1;
        const otherUser = await getUser(otherId as number);
        return {
          id: otherUser?.id,
          username: otherUser?.username,
          avatar: otherUser?.avatar,
          status: f.status,
          is_sender: f.user1 === user.id
        };
      }));
      cb(result.filter(x => x.id));
    });

    socket.on("search_users", async (query, cb) => {
      if(!query) return cb([]);
      const usersRes = await client.execute({
        sql: "SELECT id, username, avatar FROM users WHERE id != ? AND username LIKE ? LIMIT 20",
        args: [user.id, `%${query}%`]
      });
      cb(usersRes.rows);
    });

    socket.on("add_friend", async (targetId, cb) => {
      const existing = await client.execute({
        sql: "SELECT id FROM friends WHERE (user1 = ? AND user2 = ?) OR (user1 = ? AND user2 = ?)",
        args: [user.id, targetId, targetId, user.id]
      });
      if (existing.rows.length === 0) {
        await client.execute({
          sql: "INSERT INTO friends (user1, user2, status) VALUES (?, ?, 0)",
          args: [user.id, targetId]
        });
        const targetSocket = onlineUsers.get(targetId);
        if (targetSocket) io.to(targetSocket).emit("friends_updated");
        await addNotification(targetId, "friend_request", `${user.username} sana arkadaşlık isteği gönderdi.`);
      }
      if(cb) cb();
    });

    socket.on("accept_friend", async (targetId, cb) => {
      const friendRes = await client.execute({
        sql: "SELECT id FROM friends WHERE user1 = ? AND user2 = ?",
        args: [targetId, user.id]
      });
      if (friendRes.rows.length > 0) {
        await client.execute({
          sql: "UPDATE friends SET status = 1 WHERE id = ?",
          args: [friendRes.rows[0].id]
        });
        const targetSocket = onlineUsers.get(targetId);
        if (targetSocket) io.to(targetSocket).emit("friends_updated");
        await addNotification(targetId, "friend_accept", `${user.username} arkadaşlık isteğini kabul etti.`);
      }
      if(cb) cb();
    });

    socket.on("get_all_users", async (cb) => {
      const usersRes = await client.execute("SELECT id, username, avatar, color FROM users");
      cb(usersRes.rows);
    });

    // Chat
    socket.on("get_messages", async (friendId, cb) => {
      const msgRes = await client.execute({
        sql: "SELECT * FROM messages WHERE (sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?) ORDER BY created_at ASC",
        args: [user.id, friendId, friendId, user.id]
      });
      const populated = await Promise.all(msgRes.rows.map(async (r: any) => {
        let replyMsg = null;
        if (r.reply_to) {
          const refRes = await client.execute({ sql: "SELECT * FROM messages WHERE id = ?", args: [r.reply_to] });
          if (refRes.rows.length > 0) {
            const refUser = await getUser(refRes.rows[0].sender as number);
            replyMsg = { ...refRes.rows[0], sender_name: refUser?.username };
          }
        }
        return { 
          ...r, 
          reactions: JSON.parse(r.reactions as string || "[]"),
          reply_message: replyMsg,
          file_name: r.file_name,
          file_size: r.file_size
        };
      }));
      cb(populated);
    });

    socket.on("send_message", async (data) => {
      const { receiver, type, content, reply_to, file_name, file_size } = data;
      const res = await client.execute({
        sql: "INSERT INTO messages (sender, receiver, type, content, reply_to, reactions, file_name, file_size, created_at) VALUES (?, ?, ?, ?, ?, '[]', ?, ?, ?)",
        args: [user.id, receiver, type, content, reply_to || null, file_name || null, file_size || null, new Date().toISOString()]
      });
      const newMsgRes = await client.execute({ sql: "SELECT * FROM messages WHERE id = ?", args: [Number(res.lastInsertRowid)] });
      let replyMsg = null;
      if (reply_to) {
        const refRes = await client.execute({ sql: "SELECT * FROM messages WHERE id = ?", args: [reply_to] });
        if (refRes.rows.length > 0) {
          const refUser = await getUser(refRes.rows[0].sender as number);
          replyMsg = { ...refRes.rows[0], sender_name: refUser?.username };
        }
      }
      const sUser = await getUser(user.id);
      const newMsg = { 
        ...newMsgRes.rows[0], 
        reactions: [],
        sender_name: sUser?.username,
        sender_avatar: sUser?.avatar,
        sender_color: sUser?.color,
        reply_message: replyMsg,
        file_name: newMsgRes.rows[0].file_name,
        file_size: newMsgRes.rows[0].file_size
      };
      
      const targetSocket = onlineUsers.get(receiver);
      if (targetSocket) io.to(targetSocket).emit("new_message", newMsg);
      socket.emit("new_message", newMsg); // echo back
      await addNotification(receiver, "new_message", `${user.username} sana yeni bir mesaj gönderdi.`);
    });

    const populateMessage = async (m: any, type: "global" | "group") => {
      const sUser = await getUser(m.sender);
      let replyMsg = null;
      if (m.reply_to) {
         const table = type === "global" ? "global_messages" : "group_messages";
         const refMsgRes = await client.execute({ sql: `SELECT * FROM ${table} WHERE id = ?`, args: [m.reply_to] });
         if (refMsgRes.rows.length > 0) {
           const refMsg = refMsgRes.rows[0];
           const refUser = await getUser(refMsg.sender as number);
           replyMsg = { ...refMsg, sender_name: refUser?.username };
         }
      }
      return { 
        ...m, 
        reactions: JSON.parse(m.reactions as string || "[]"), 
        sender_name: sUser?.username, 
        sender_avatar: sUser?.avatar, 
        sender_color: sUser?.color, 
        reply_message: replyMsg,
        file_name: m.file_name,
        file_size: m.file_size
      };
    };

    // Global Chat
    socket.on("get_global_messages", async (cb) => {
      const msgs = await client.execute("SELECT * FROM (SELECT * FROM global_messages ORDER BY created_at DESC LIMIT 100) ORDER BY created_at ASC");
      const populated = await Promise.all(msgs.rows.map(m => populateMessage(m, "global")));
      cb(populated);
    });

    socket.on("send_global_message", async (data) => {
      const { type, content, reply_to, file_name, file_size } = data;
      const res = await client.execute({
        sql: "INSERT INTO global_messages (sender, type, content, reply_to, reactions, file_name, file_size, created_at) VALUES (?, ?, ?, ?, '[]', ?, ?, ?)",
        args: [user.id, type, content, reply_to || null, file_name || null, file_size || null, new Date().toISOString()]
      });
      const newMsgRes = await client.execute({ sql: "SELECT * FROM global_messages WHERE id = ?", args: [Number(res.lastInsertRowid)] });
      const popMsg = await populateMessage(newMsgRes.rows[0], "global");
      io.emit("new_global_message", popMsg);
    });

    // Groups
    socket.on("get_groups", async (cb) => {
      const groupsRes = await client.execute("SELECT * FROM groups");
      const myGroups = groupsRes.rows.filter(g => {
         const members = JSON.parse(g.members as string || "[]");
         return members.includes(Number(user.id));
      }).map(g => ({ ...g, members: JSON.parse(g.members as string || "[]") }));
      cb(myGroups);
    });

    socket.on("create_group", async (data, cb) => {
      const { name, members } = data; 
      const allMembers = [Number(user.id), ...members];
      const res = await client.execute({
        sql: "INSERT INTO groups (name, creator, members, created_at) VALUES (?, ?, ?, ?)",
        args: [name, user.id, JSON.stringify(allMembers), new Date().toISOString()]
      });
      const newGroupRes = await client.execute({ sql: "SELECT * FROM groups WHERE id = ?", args: [Number(res.lastInsertRowid)] });
      const newGroup = { ...newGroupRes.rows[0], members: JSON.parse(newGroupRes.rows[0].members as string || "[]") };
      
      allMembers.forEach(async (memberId: number) => {
        const targetSocket = onlineUsers.get(memberId);
        if (targetSocket) io.to(targetSocket).emit("groups_updated");
        await addNotification(memberId, "group_invite", `${user.username} seni ${name} grubuna ekledi.`);
      });
      if(cb) cb(newGroup);
    });

    socket.on("get_group_messages", async (groupId, cb) => {
      const msgsRes = await client.execute({
        sql: "SELECT * FROM group_messages WHERE group_id = ? ORDER BY created_at ASC",
        args: [groupId]
      });
      const populated = await Promise.all(msgsRes.rows.map(m => populateMessage(m, "group")));
      cb(populated);
    });

    socket.on("send_group_message", async (data) => {
      const { group_id, type, content, reply_to, file_name, file_size } = data;
      const res = await client.execute({
        sql: "INSERT INTO group_messages (group_id, sender, type, content, reply_to, reactions, file_name, file_size, created_at) VALUES (?, ?, ?, ?, ?, '[]', ?, ?, ?)",
        args: [group_id, user.id, type, content, reply_to || null, file_name || null, file_size || null, new Date().toISOString()]
      });
      
      const groupRes = await client.execute({ sql: "SELECT * FROM groups WHERE id = ?", args: [group_id] });
      if (groupRes.rows.length > 0) {
        const group = groupRes.rows[0];
        const members = JSON.parse(group.members as string || "[]");
        const newMsgRes = await client.execute({ sql: "SELECT * FROM group_messages WHERE id = ?", args: [Number(res.lastInsertRowid)] });
        const popMsg = await populateMessage(newMsgRes.rows[0], "group");
        members.forEach(async (memberId: number) => {
          const targetSocket = onlineUsers.get(memberId);
          if (targetSocket) io.to(targetSocket).emit("new_group_message", popMsg);
          await addNotification(memberId, "new_group_message", `${group.name} grubuna yeni bir mesaj geldi.`);
        });
      }
    });

    socket.on("typing", async (data) => {
      if (data.type === 'private') {
        const targetSocket = onlineUsers.get(data.receiver);
        if (targetSocket) io.to(targetSocket).emit("user_typing", { type: 'private', sender: user.id });
      } else if (data.type === 'group') {
        const groupRes = await client.execute({ sql: "SELECT * FROM groups WHERE id = ?", args: [data.group_id] });
        if (groupRes.rows.length > 0) {
          const members = JSON.parse(groupRes.rows[0].members as string || "[]");
          members.forEach((memberId: number) => {
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

    socket.on("react_message", async (data) => {
       let table = "";
       if (data.type === 'private') table = "messages";
       else if (data.type === 'group') table = "group_messages";
       else if (data.type === 'global') table = "global_messages";
       
       if (table) {
         const msgRes = await client.execute({ sql: `SELECT * FROM ${table} WHERE id = ?`, args: [data.message_id] });
         if (msgRes.rows.length > 0) {
           const msg = msgRes.rows[0];
           const reactions = JSON.parse(msg.reactions as string || "[]");
           const existingIdx = reactions.findIndex((r: any) => r.user_id === user.id && r.emoji === data.emoji);
           if (existingIdx > -1) {
             reactions.splice(existingIdx, 1);
           } else {
             reactions.push({ user_id: user.id, emoji: data.emoji });
           }
           await client.execute({
             sql: `UPDATE ${table} SET reactions = ? WHERE id = ?`,
             args: [JSON.stringify(reactions), data.message_id]
           });
           io.emit("message_reacted", { type: data.type, message_id: data.message_id, reactions });
         }
       }
    });

    socket.on("update_avatar", async (url) => {
      await client.execute({
        sql: "UPDATE users SET avatar = ? WHERE id = ?",
        args: [url, user.id]
      });
      io.emit("feed_updated");
      io.emit("friends_updated");
    });

    socket.on("disconnect", async () => {
      await client.execute({
        sql: "UPDATE users SET last_seen = ? WHERE id = ?",
        args: [new Date().toISOString(), user.id]
      });
      onlineUsers.delete(Number(user.id));
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
