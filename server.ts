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
import { 
  generateDeck, 
  checkClassicOkeyWin,
  Tile 
} from "./src/utils/okeyEngine.ts";
import { 
  createUnoDeck, 
  isCardPlayable, 
  UnoCard, 
  UnoColor, 
  COLOR_STYLES,
  shuffleCards 
} from "./src/utils/unoEngine.ts";

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
  try {
    await client.execute(`ALTER TABLE users ADD COLUMN okey_wins INTEGER DEFAULT 0`);
  } catch (e) {}
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

  await client.execute(`CREATE TABLE IF NOT EXISTS followers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    follower_id INTEGER NOT NULL,
    following_id INTEGER NOT NULL,
    created_at TEXT,
    UNIQUE(follower_id, following_id)
  )`);
  
  // Migrations for existing tables
  try { await client.execute("ALTER TABLE messages ADD COLUMN file_name TEXT"); } catch(e){}
  try { await client.execute("ALTER TABLE messages ADD COLUMN file_size TEXT"); } catch(e){}
  try { await client.execute("ALTER TABLE group_messages ADD COLUMN file_name TEXT"); } catch(e){}
  try { await client.execute("ALTER TABLE group_messages ADD COLUMN file_size TEXT"); } catch(e){}
  try { await client.execute("ALTER TABLE global_messages ADD COLUMN file_name TEXT"); } catch(e){}
  try { await client.execute("ALTER TABLE global_messages ADD COLUMN file_size TEXT"); } catch(e){}
  try { await client.execute("ALTER TABLE posts ADD COLUMN media_type TEXT"); } catch(e){}
  try { await client.execute("ALTER TABLE posts ADD COLUMN subject TEXT"); } catch(e){}
  try { await client.execute("ALTER TABLE users ADD COLUMN uno_wins INTEGER DEFAULT 0"); } catch(e){}
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
          // Now that it's on disk, use sendFile to support range requests and proper headers
          return res.sendFile(filePath);
        } catch (e) {
          console.error("Cache write error:", e);
          if (row.mimetype) {
            res.setHeader("Content-Type", row.mimetype as string);
          }
          return res.send(buffer);
        }
      } else {
        return res.status(404).send("File not found");
      }
    } catch (err) {
      console.error("Error restoring file from cloud DB:", err);
      return res.status(500).send("Internal Server Error");
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

  app.delete("/api/posts/:id", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const userRes = await client.execute({ sql: "SELECT * FROM users WHERE token = ?", args: [token] });
      if (userRes.rows.length === 0) return res.status(401).json({ error: "Unauthorized" });
      const authUser = userRes.rows[0];
      const postId = req.params.id;
      const postRes = await client.execute({ sql: "SELECT user_id FROM posts WHERE id = ?", args: [postId] });
      if (postRes.rows.length === 0) return res.status(404).json({ error: "Post not found" });
      
      const isEmirgan = authUser.username && (authUser.username as string).trim().toLowerCase() === 'emirgan';
      if (Number(postRes.rows[0].user_id) !== Number(authUser.id) && !isEmirgan) {
        return res.status(403).json({ error: "Yetkisiz işlem" });
      }

      await client.execute({ sql: "DELETE FROM posts WHERE id = ?", args: [postId] });
      await client.execute({ sql: "DELETE FROM likes WHERE post_id = ?", args: [postId] });
      await client.execute({ sql: "DELETE FROM comments WHERE post_id = ?", args: [postId] });
      io.emit("post_deleted", { postId: Number(postId) });
      io.emit("feed_updated");
      return res.json({ success: true, postId: Number(postId) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/messages/:id", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const userRes = await client.execute({ sql: "SELECT * FROM users WHERE token = ?", args: [token] });
      if (userRes.rows.length === 0) return res.status(401).json({ error: "Unauthorized" });
      const authUser = userRes.rows[0];
      const messageId = Number(req.params.id);
      
      const isEmirgan = authUser.username && (authUser.username as string).trim().toLowerCase() === 'emirgan';
      
      for (const tbl of ["messages", "global_messages", "group_messages"]) {
        const msgRes = await client.execute({ sql: `SELECT sender FROM ${tbl} WHERE id = ?`, args: [messageId] });
        if (msgRes.rows.length > 0) {
          const senderId = Number(msgRes.rows[0].sender);
          if (senderId !== Number(authUser.id) && !isEmirgan) {
            return res.status(403).json({ error: "Bu mesajı silme yetkiniz yok." });
          }
          await client.execute({ sql: `DELETE FROM ${tbl} WHERE id = ?`, args: [messageId] });
          io.emit("message_deleted", { message_id: messageId, id: messageId });
          return res.json({ success: true, message_id: messageId });
        }
      }
      return res.status(404).json({ error: "Mesaj bulunamadı." });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Performance-Friendly Top 10 Leaderboard (Okey & UNO)
  app.get("/api/leaderboard", async (req, res) => {
    try {
      const type = req.query.type === "uno" ? "uno" : "okey";
      const orderCol = type === "uno" ? "uno_wins" : "okey_wins";
      const result = await client.execute({
        sql: `SELECT id, username, avatar, color, COALESCE(okey_wins, 0) AS okey_wins, COALESCE(uno_wins, 0) AS uno_wins FROM users ORDER BY COALESCE(${orderCol}, 0) DESC, id ASC LIMIT 10`,
        args: []
      });
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin (emirgan) User Deletion Endpoint
  app.delete("/api/admin/users/:id", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const userRes = await client.execute({ sql: "SELECT * FROM users WHERE token = ?", args: [token] });
      if (userRes.rows.length === 0) return res.status(401).json({ error: "Unauthorized" });
      const authUser = userRes.rows[0];

      const isEmirgan = authUser.username && (authUser.username as string).trim().toLowerCase() === 'emirgan';
      if (!isEmirgan) {
        return res.status(403).json({ error: "Yetkisiz işlem: Sadece yönetici emirgan kullanıcı silebilir." });
      }

      const targetId = Number(req.params.id);
      const targetRes = await client.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [targetId] });
      if (targetRes.rows.length === 0) return res.status(404).json({ error: "Kullanıcı bulunamadı." });
      const targetUser = targetRes.rows[0];
      if (targetUser.username && (targetUser.username as string).trim().toLowerCase() === 'emirgan') {
        return res.status(400).json({ error: "Yönetici hesabı silinemez." });
      }

      // Kalıcı olarak Turso'dan ilişkili tüm verilerle temizle
      await client.execute({ sql: "DELETE FROM users WHERE id = ?", args: [targetId] });
      await client.execute({ sql: "DELETE FROM posts WHERE user_id = ?", args: [targetId] });
      await client.execute({ sql: "DELETE FROM likes WHERE user_id = ?", args: [targetId] });
      await client.execute({ sql: "DELETE FROM comments WHERE user_id = ?", args: [targetId] });
      await client.execute({ sql: "DELETE FROM friends WHERE user1 = ? OR user2 = ?", args: [targetId, targetId] });
      await client.execute({ sql: "DELETE FROM messages WHERE sender = ? OR receiver = ?", args: [targetId, targetId] });
      await client.execute({ sql: "DELETE FROM stories WHERE user_id = ?", args: [targetId] });
      await client.execute({ sql: "DELETE FROM notifications WHERE user_id = ?", args: [targetId] });

      const targetSocketId = onlineUsers.get(targetId);
      if (targetSocketId) {
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
          targetSocket.emit("account_deleted", "Hesabınız yönetici tarafından kapatılmıştır.");
          targetSocket.disconnect(true);
        }
        onlineUsers.delete(targetId);
      }

      io.emit("user_deleted", { userId: targetId });
      io.emit("feed_updated");
      io.emit("friends_updated");
      return res.json({ success: true, message: "Kullanıcı başarıyla silindi." });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Socket Online Tracking with Reconnection Grace Period (Graceful disconnect for mobile networks)
  const onlineUsers = new Map<number, string>();
  const disconnectTimers = new Map<number, NodeJS.Timeout>();
  const globalRead = new Map<number, number>();
  const chatRead = new Map<number, Map<number, number>>();
  
  const okeyRooms = new Map<string, any>();

  const getSanitizedRoom = (room: any) => {
    return {
      id: room.id,
      name: room.name,
      gameMode: 'classic',
      status: room.status,
      hostId: room.hostId || room.creatorId,
      creatorId: room.creatorId,
      players: room.players.map((p: any) => ({
        id: p.id,
        username: p.username,
        avatar: p.avatar,
        color: p.color,
        isBot: !!p.isBot,
        tileCount: p.hand ? p.hand.length : 0,
        discardPile: p.discardPile || [],
        score: p.score || 0
      })),
      deckCount: room.deck ? room.deck.length : 0,
      indicator: room.indicator,
      okeyTile: room.okeyTile,
      currentTurn: room.currentTurn || 0,
      turnPhase: room.turnPhase || 'draw',
      winnerId: room.winnerId,
      winningReason: room.winningReason,
      lastActionMessage: room.lastActionMessage
    };
  };

  const broadcastOkeyRoom = (roomId: string) => {
    const room = okeyRooms.get(roomId);
    if (!room) return;
    const publicState = getSanitizedRoom(room);
    io.to(`okey_${roomId}`).emit("okey_state", publicState);
    for (const p of room.players) {
      if (!p.isBot) {
        const targetSockets = new Set<string>();
        if (p.socketId) targetSockets.add(p.socketId);
        const globalSock = onlineUsers.get(Number(p.id));
        if (globalSock) targetSockets.add(globalSock);
        
        targetSockets.forEach(sId => {
          io.to(sId).emit("okey_hand", p.hand || []);
        });
      }
    }
  };

  const runBotTurn = (roomId: string) => {
    const room = okeyRooms.get(roomId);
    if (!room || room.status !== 'playing') return;
    const currPlayer = room.players[room.currentTurn];
    if (!currPlayer || !currPlayer.isBot) return;

    clearTimeout(room.botTimeout);
    room.botTimeout = setTimeout(() => {
      const r = okeyRooms.get(roomId);
      if (!r || r.status !== 'playing') return;
      const bot = r.players[r.currentTurn];
      if (!bot || !bot.isBot) return;

      if (r.turnPhase === 'draw') {
        // Draw from deck or side
        const prevIdx = (r.currentTurn + r.players.length - 1) % r.players.length;
        const prevPlayer = r.players[prevIdx];
        const canTakeSide = prevPlayer && prevPlayer.discardPile && prevPlayer.discardPile.length > 0;

        if (canTakeSide && Math.random() < 0.25) {
          const drawn = prevPlayer.discardPile.pop();
          bot.hand.push(drawn);
          r.lastActionMessage = `${bot.username} yandan atılan taşı aldı.`;
        } else if (r.deck.length > 0) {
          const drawn = r.deck.pop();
          if (drawn) {
            bot.hand.push(drawn);
            r.lastActionMessage = `${bot.username} desteden taş çekti.`;
          }
        }
        r.turnPhase = 'discard';
        broadcastOkeyRoom(roomId);
      }

      r.botTimeout = setTimeout(() => {
        const r2 = okeyRooms.get(roomId);
        if (!r2 || r2.status !== 'playing') return;
        const bot2 = r2.players[r2.currentTurn];
        if (!bot2 || !bot2.isBot) return;

        // Check if bot can declare win
        const winCheck = checkClassicOkeyWin(bot2.hand, r2.okeyTile);
        if (winCheck.canWin) {
          r2.status = 'ended';
          r2.winnerId = bot2.id;
          r2.winningReason = `${bot2.username} ${winCheck.reason || 'elini bitirdi ve kazandı!'} 🏆`;
          r2.lastActionMessage = `${bot2.username} oyunu bitirdi!`;
          broadcastOkeyRoom(roomId);
          return;
        }

        // Otherwise discard a non-okey tile
        let discardIdx = bot2.hand.findIndex((t: any) => !t.isOkey);
        if (discardIdx === -1) discardIdx = 0;
        const discarded = bot2.hand.splice(discardIdx, 1)[0];
        if (discarded) {
          bot2.discardPile.push(discarded);
          const colorText = discarded.color === 'red' ? 'Kırmızı' : discarded.color === 'blue' ? 'Mavi' : discarded.color === 'black' ? 'Siyah' : 'Sarı';
          r2.lastActionMessage = `${bot2.username} ${discarded.number} ${colorText} attı.`;
        }

        r2.currentTurn = (r2.currentTurn + 1) % r2.players.length;
        r2.turnPhase = 'draw';
        broadcastOkeyRoom(roomId);

        if (r2.players[r2.currentTurn]?.isBot) {
          runBotTurn(roomId);
        }
      }, 1200);

    }, 1000);
  };

  // --- UNO Game Engine & Logic (Completely Isolated from Okey) ---
  const unoRooms = new Map<string, any>();

  const getSanitizedUnoRoom = (room: any) => {
    return {
      id: room.id,
      name: room.name,
      status: room.status,
      hostId: room.hostId || room.creatorId,
      creatorId: room.creatorId,
      players: room.players.map((p: any) => ({
        id: p.id,
        username: p.username,
        avatar: p.avatar,
        color: p.color,
        isBot: !!p.isBot,
        cardCount: p.hand ? p.hand.length : 0,
        hasCalledUno: !!p.hasCalledUno,
        score: p.score || 0
      })),
      deckCount: room.deck ? room.deck.length : 0,
      topCard: room.topCard,
      activeColor: room.activeColor,
      direction: room.direction || 1,
      currentTurn: room.currentTurn || 0,
      winnerId: room.winnerId,
      lastActionMessage: room.lastActionMessage,
      discardPileCount: room.discardPile ? room.discardPile.length : 0
    };
  };

  const broadcastUnoRoom = (roomId: string) => {
    const room = unoRooms.get(roomId);
    if (!room) return;
    const publicState = getSanitizedUnoRoom(room);
    io.to(`uno_${roomId}`).emit("uno_state", publicState);

    for (const p of room.players) {
      if (!p.isBot) {
        const targetSockets = new Set<string>();
        if (p.socketId) targetSockets.add(p.socketId);
        const globalSock = onlineUsers.get(Number(p.id));
        if (globalSock) targetSockets.add(globalSock);

        targetSockets.forEach(sId => {
          io.to(sId).emit("uno_hand", p.hand || []);
        });
      }
    }
  };

  const drawCardsFromUnoDeck = (room: any, count: number): UnoCard[] => {
    const drawn: UnoCard[] = [];
    for (let i = 0; i < count; i++) {
      if (!room.deck || room.deck.length === 0) {
        if (room.discardPile && room.discardPile.length > 0) {
          room.deck = shuffleCards([...room.discardPile]);
          room.discardPile = [];
        } else {
          room.deck = createUnoDeck();
        }
      }
      if (room.deck.length > 0) {
        drawn.push(room.deck.pop()!);
      }
    }
    return drawn;
  };

  const advanceUnoTurn = (room: any, steps: number = 1) => {
    const n = room.players.length;
    if (n === 0) return;
    room.currentTurn = ((room.currentTurn + (steps * room.direction)) % n + n) % n;
  };

  const getNextUnoPlayer = (room: any, steps: number = 1) => {
    const n = room.players.length;
    const nextIdx = ((room.currentTurn + (steps * room.direction)) % n + n) % n;
    return room.players[nextIdx];
  };

  const emitUnoRoomsList = () => {
    const list = Array.from(unoRooms.entries()).map(([id, r]) => ({
      id,
      name: r.name,
      players: r.players.length,
      status: r.status
    }));
    io.emit("uno_rooms_list", list);
  };

  const executePlayUnoCard = (room: any, player: any, cardId: string, chosenColor?: UnoColor) => {
    const cardIdx = player.hand.findIndex((c: UnoCard) => c.id === cardId);
    if (cardIdx === -1) return false;
    const card = player.hand[cardIdx];

    // Check UNO penalty: if player had 2 cards and plays without calling UNO, they draw 2 cards
    if (player.hand.length === 2 && !player.hasCalledUno) {
      const penaltyCards = drawCardsFromUnoDeck(room, 2);
      player.hand.push(...penaltyCards);
      room.lastActionMessage = `⚠️ ${player.username} "UNO!" demediği için 2 ceza kartı çekti!`;
    }

    // Remove card from hand
    player.hand.splice(cardIdx, 1);
    player.hasCalledUno = false; // Reset after turn

    // Put current top card into discard pile
    if (room.topCard) {
      room.discardPile.push(room.topCard);
    }
    room.topCard = card;

    // Set active color
    if (card.color === 'wild' || card.value === 'wild' || card.value === 'wild4') {
      room.activeColor = chosenColor || 'red';
    } else {
      room.activeColor = card.color;
    }

    // Check Win condition
    if (player.hand.length === 0) {
      room.status = 'ended';
      room.winnerId = player.id;
      room.lastActionMessage = `🏆 ${player.username} tüm kartlarını bitirerek UNO'yu KAZANDI!`;
      if (!player.isBot) {
        client.execute({
          sql: "UPDATE users SET uno_wins = COALESCE(uno_wins, 0) + 1 WHERE id = ?",
          args: [player.id]
        }).catch(console.error);
      }
      broadcastUnoRoom(room.id);
      emitUnoRoomsList();
      return true;
    }

    // Handle Action Cards
    const colorLabel = COLOR_STYLES[room.activeColor]?.label || room.activeColor;
    if (card.value === 'reverse') {
      if (room.players.length === 2) {
        // In 2 player, reverse acts like a skip
        room.lastActionMessage = `${player.username} Yön Değiştirme kartı oynadı (Pas)! Sıra yine kendisinde.`;
      } else {
        room.direction = (room.direction === 1 ? -1 : 1);
        advanceUnoTurn(room, 1);
        room.lastActionMessage = `${player.username} oyun yönünü tersine çevirdi!`;
      }
    } else if (card.value === 'skip') {
      const skippedPlayer = getNextUnoPlayer(room, 1);
      advanceUnoTurn(room, 2);
      room.lastActionMessage = `${player.username}, ${skippedPlayer.username}'in sırasını engelledi (Pas)!`;
    } else if (card.value === 'draw2') {
      const victim = getNextUnoPlayer(room, 1);
      const drawn = drawCardsFromUnoDeck(room, 2);
      victim.hand.push(...drawn);
      advanceUnoTurn(room, 2);
      room.lastActionMessage = `${victim.username} 2 kart çekti ve sırası atlandı!`;
    } else if (card.value === 'wild4') {
      const victim = getNextUnoPlayer(room, 1);
      const drawn = drawCardsFromUnoDeck(room, 4);
      victim.hand.push(...drawn);
      advanceUnoTurn(room, 2);
      room.lastActionMessage = `${player.username} yeni rengi ${colorLabel} yaptı! ${victim.username} 4 kart çekti ve sırası atlandı!`;
    } else if (card.value === 'wild') {
      advanceUnoTurn(room, 1);
      room.lastActionMessage = `${player.username} rengi ${colorLabel} olarak belirledi.`;
    } else {
      // Normal number card
      advanceUnoTurn(room, 1);
      room.lastActionMessage = `${player.username} ${colorLabel} ${card.value} oynadı.`;
    }

    broadcastUnoRoom(room.id);

    // If next player is bot, trigger bot turn
    const nextPlayer = room.players[room.currentTurn];
    if (nextPlayer && nextPlayer.isBot) {
      runBotTurnUno(room.id);
    }
    return true;
  };

  const runBotTurnUno = (roomId: string) => {
    const room = unoRooms.get(roomId);
    if (!room || room.status !== 'playing') return;
    clearTimeout(room.botTimeout);

    const currentPlayer = room.players[room.currentTurn];
    if (!currentPlayer || !currentPlayer.isBot) return;

    room.botTimeout = setTimeout(() => {
      const freshRoom = unoRooms.get(roomId);
      if (!freshRoom || freshRoom.status !== 'playing') return;
      const bot = freshRoom.players[freshRoom.currentTurn];
      if (!bot || !bot.isBot) return;

      // Find playable cards
      const playableCards = bot.hand.filter((c: UnoCard) => 
        isCardPlayable(c, freshRoom.topCard, freshRoom.activeColor)
      );

      if (playableCards.length > 0) {
        // Prioritize action cards or matching colors
        const actionCards = playableCards.filter((c: UnoCard) => ['draw2', 'skip', 'reverse', 'wild4', 'wild'].includes(c.value));
        const cardToPlay = actionCards.length > 0 && Math.random() < 0.6 
          ? actionCards[Math.floor(Math.random() * actionCards.length)]
          : playableCards[Math.floor(Math.random() * playableCards.length)];

        let chosenColor: UnoColor = 'red';
        if (cardToPlay.color === 'wild' || cardToPlay.value === 'wild' || cardToPlay.value === 'wild4') {
          const colorCounts: Record<string, number> = { red: 0, blue: 0, green: 0, yellow: 0 };
          for (const c of bot.hand) {
            if (c.color !== 'wild') {
              colorCounts[c.color] = (colorCounts[c.color] || 0) + 1;
            }
          }
          let best = 'red';
          let max = -1;
          for (const col of ['red', 'blue', 'green', 'yellow']) {
            if (colorCounts[col] > max) {
              max = colorCounts[col];
              best = col;
            }
          }
          chosenColor = best as UnoColor;
        }

        // Call UNO if 2 cards left before playing
        if (bot.hand.length === 2) {
          bot.hasCalledUno = true;
        }

        executePlayUnoCard(freshRoom, bot, cardToPlay.id, chosenColor);
      } else {
        // No playable card, draw 1 from deck
        const drawnCards = drawCardsFromUnoDeck(freshRoom, 1);
        if (drawnCards.length > 0) {
          const drawn = drawnCards[0];
          bot.hand.push(drawn);
          if (isCardPlayable(drawn, freshRoom.topCard, freshRoom.activeColor)) {
            let chosenColor: UnoColor = 'red';
            if (drawn.color === 'wild' || drawn.value === 'wild' || drawn.value === 'wild4') {
              const colorCounts: Record<string, number> = { red: 0, blue: 0, green: 0, yellow: 0 };
              for (const c of bot.hand) {
                if (c.color !== 'wild') colorCounts[c.color] = (colorCounts[c.color] || 0) + 1;
              }
              chosenColor = (Object.keys(colorCounts).reduce((a, b) => colorCounts[a] > colorCounts[b] ? a : b) || 'red') as UnoColor;
            }
            if (bot.hand.length === 2) {
              bot.hasCalledUno = true;
            }
            executePlayUnoCard(freshRoom, bot, drawn.id, chosenColor);
            return;
          }
        }
        // Cannot play, pass turn
        advanceUnoTurn(freshRoom, 1);
        freshRoom.lastActionMessage = `${bot.username} yerden kart çekti ve pas geçti.`;
        broadcastUnoRoom(freshRoom.id);

        const nextP = freshRoom.players[freshRoom.currentTurn];
        if (nextP && nextP.isBot) {
          runBotTurnUno(freshRoom.id);
        }
      }
    }, 1300);
  };

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
    const userIdNum = Number(user.id);

    // Cancel any pending disconnect cleanup timer for this user (they reconnected)
    if (disconnectTimers.has(userIdNum)) {
      clearTimeout(disconnectTimers.get(userIdNum)!);
      disconnectTimers.delete(userIdNum);
    }

    onlineUsers.set(userIdNum, socket.id);
    socket.emit("your_id", userIdNum);
    io.emit("online_users", Array.from(onlineUsers.keys()));

    // Active ping / heartbeat to keep presence fresh when tab becomes visible
    socket.on("heartbeat", () => {
      if (disconnectTimers.has(userIdNum)) {
        clearTimeout(disconnectTimers.get(userIdNum)!);
        disconnectTimers.delete(userIdNum);
      }
      if (!onlineUsers.has(userIdNum) || onlineUsers.get(userIdNum) !== socket.id) {
        onlineUsers.set(userIdNum, socket.id);
        io.emit("online_users", Array.from(onlineUsers.keys()));
      }
    });

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
        // Get followers and following counts
        const followersRes = await client.execute({ sql: "SELECT COUNT(*) as count FROM followers WHERE following_id = ?", args: [targetId] });
        const followingRes = await client.execute({ sql: "SELECT COUNT(*) as count FROM followers WHERE follower_id = ?", args: [targetId] });
        
        let isFollowing = false;
        if (targetId !== user.id) {
           const checkRes = await client.execute({ sql: "SELECT * FROM followers WHERE follower_id = ? AND following_id = ?", args: [user.id, targetId] });
           isFollowing = checkRes.rows.length > 0;
        }

        cb({ 
          id: u.id, 
          username: u.username, 
          avatar: u.avatar, 
          color: u.color,
          followersCount: Number(followersRes.rows[0]?.count || 0),
          followingCount: Number(followingRes.rows[0]?.count || 0),
          isFollowing
        });
      } else {
        cb(null);
      }
    });

    socket.on("toggle_follow", async (targetId) => {
      if (targetId === user.id) return;
      const checkRes = await client.execute({ sql: "SELECT id FROM followers WHERE follower_id = ? AND following_id = ?", args: [user.id, targetId] });
      
      if (checkRes.rows.length > 0) {
        // Unfollow
        await client.execute({ sql: "DELETE FROM followers WHERE follower_id = ? AND following_id = ?", args: [user.id, targetId] });
      } else {
        // Follow
        await client.execute({ sql: "INSERT INTO followers (follower_id, following_id, created_at) VALUES (?, ?, ?)", args: [user.id, targetId, new Date().toISOString()] });
        
        // Notify
        await client.execute({
          sql: "INSERT INTO notifications (user_id, type, content, created_at) VALUES (?, ?, ?, ?)",
          args: [targetId, 'follow', `${user.username} seni takip etmeye başladı.`, new Date().toISOString()]
        });
        const targetSockId = onlineUsers.get(Number(targetId));
        if (targetSockId) {
          io.to(targetSockId).emit("notifications_updated");
        }
      }
      
      // Update both users
      io.to(socket.id).emit("profile_updated", targetId);
      const targetSockId = onlineUsers.get(Number(targetId));
      if (targetSockId) {
        io.to(targetSockId).emit("profile_updated", user.id);
      }
    });

    socket.on("get_user_posts", async (targetId, cb) => {
      try {
        const postsRes = await client.execute({ sql: "SELECT * FROM posts WHERE user_id = ? ORDER BY created_at DESC LIMIT 50", args: [targetId] });
        const postIds = postsRes.rows.map((p: any) => p.id);
        
        let likesRes: any = { rows: [] };
        let commentsRes: any = { rows: [] };
        if (postIds.length > 0) {
          const placeholders = postIds.map(() => "?").join(",");
          likesRes = await client.execute({ sql: `SELECT * FROM likes WHERE post_id IN (${placeholders})`, args: postIds });
          commentsRes = await client.execute({ sql: `SELECT * FROM comments WHERE post_id IN (${placeholders})`, args: postIds });
        }
        
        const populated = await Promise.all(postsRes.rows.map(async (p: any) => {
          const pUser = await getUser(p.user_id as number);
          const postLikes = likesRes.rows.filter((l: any) => l.post_id === p.id);
          const postComments = await Promise.all(commentsRes.rows.filter((c: any) => c.post_id === p.id).map(async (c: any) => {
            const cu = await getUser(c.user_id as number);
            return { ...c, username: cu?.username, user_avatar: cu?.avatar, user_color: cu?.color };
          }));
          const is_liked = postLikes.some((l: any) => l.user_id === user.id);
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
    socket.on("get_feed", async (subjectFilter, cb) => {
      if (typeof subjectFilter === "function") {
        cb = subjectFilter;
        subjectFilter = null;
      }
      try {
        let postsRes;
        if (subjectFilter) {
          postsRes = await client.execute({ sql: "SELECT * FROM posts WHERE subject = ? ORDER BY created_at DESC LIMIT 50", args: [subjectFilter] });
        } else {
          postsRes = await client.execute({ sql: "SELECT * FROM posts WHERE subject IS NULL ORDER BY created_at DESC LIMIT 50", args: [] });
        }
        const postIds = postsRes.rows.map((p: any) => p.id);
        let likesRes: any = { rows: [] };
        if (postIds.length > 0) {
          const placeholders = postIds.map(() => "?").join(",");
          likesRes = await client.execute({ sql: `SELECT * FROM likes WHERE post_id IN (${placeholders})`, args: postIds });
        }
        
        const populated = await Promise.all(postsRes.rows.map(async (p: any) => {
          const pUser = await getUser(p.user_id as number);
          const postLikes = likesRes.rows.filter((l: any) => l.post_id === p.id);
          const is_liked = postLikes.some((l: any) => l.user_id === user.id);
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
        sql: "INSERT INTO posts (user_id, image, caption, media_type, subject, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        args: [user.id, data.image, data.caption, mediaType || "image", data.subject || null, new Date().toISOString()]
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

    socket.on("delete_post", async (rawPostId, cb) => {
      try {
        const postId = typeof rawPostId === "object" && rawPostId !== null ? (rawPostId.id || rawPostId.postId) : rawPostId;
        const postRes = await client.execute({
          sql: "SELECT user_id FROM posts WHERE id = ?",
          args: [postId]
        });
        if (postRes.rows.length === 0) {
          if (cb) cb({ error: "Post bulunamadı." });
          return;
        }

        const isEmirgan = user.username && user.username.trim().toLowerCase() === 'emirgan';
        const postOwnerId = Number(postRes.rows[0].user_id);
        const currentUserId = Number(user.id);

        if (postOwnerId !== currentUserId && !isEmirgan) {
          if (cb) cb({ error: "Yetkisiz işlem" });
          return;
        }

        await client.execute({ sql: "DELETE FROM posts WHERE id = ?", args: [postId] });
        await client.execute({ sql: "DELETE FROM likes WHERE post_id = ?", args: [postId] });
        await client.execute({ sql: "DELETE FROM comments WHERE post_id = ?", args: [postId] });
        
        io.emit("post_deleted", { postId: Number(postId) });
        io.emit("feed_updated");
        if (cb) cb({ success: true, postId: Number(postId) });
      } catch (err) {
        console.error("delete_post socket error:", err);
        if (cb) cb({ error: "Silme işlemi sırasında hata oluştu." });
      }
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
        sql: "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
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

    // Leaderboard Socket Event
    socket.on("get_leaderboard", async (data: { type?: 'okey' | 'uno' } | undefined, cb: (rows: any[]) => void) => {
      try {
        const gameType = data?.type === 'uno' ? 'uno' : 'okey';
        const orderCol = gameType === 'uno' ? 'uno_wins' : 'okey_wins';
        const result = await client.execute({
          sql: `SELECT id, username, avatar, color, COALESCE(okey_wins, 0) AS okey_wins, COALESCE(uno_wins, 0) AS uno_wins FROM users ORDER BY COALESCE(${orderCol}, 0) DESC, id ASC LIMIT 10`,
          args: []
        });
        if (cb) cb(result.rows);
      } catch (err: any) {
        console.error("get_leaderboard error:", err);
        if (cb) cb([]);
      }
    });

    // Admin (emirgan) User Deletion Socket Event
    socket.on("admin_delete_user", async ({ userId }: { userId: number }, cb?: (res: any) => void) => {
      const isEmirgan = user.username && user.username.trim().toLowerCase() === 'emirgan';
      if (!isEmirgan) {
        if (cb) cb({ error: "Yetkisiz işlem: Sadece yönetici emirgan kullanıcı silebilir." });
        return;
      }
      try {
        const targetId = Number(userId);
        const targetRes = await client.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [targetId] });
        if (targetRes.rows.length === 0) {
          if (cb) cb({ error: "Kullanıcı bulunamadı." });
          return;
        }
        const targetUser = targetRes.rows[0];
        if (targetUser.username && (targetUser.username as string).trim().toLowerCase() === 'emirgan') {
          if (cb) cb({ error: "Yönetici hesabı silinemez." });
          return;
        }

        // Kalıcı silme
        await client.execute({ sql: "DELETE FROM users WHERE id = ?", args: [targetId] });
        await client.execute({ sql: "DELETE FROM posts WHERE user_id = ?", args: [targetId] });
        await client.execute({ sql: "DELETE FROM likes WHERE user_id = ?", args: [targetId] });
        await client.execute({ sql: "DELETE FROM comments WHERE user_id = ?", args: [targetId] });
        await client.execute({ sql: "DELETE FROM friends WHERE user1 = ? OR user2 = ?", args: [targetId, targetId] });
        await client.execute({ sql: "DELETE FROM messages WHERE sender = ? OR receiver = ?", args: [targetId, targetId] });
        await client.execute({ sql: "DELETE FROM stories WHERE user_id = ?", args: [targetId] });
        await client.execute({ sql: "DELETE FROM notifications WHERE user_id = ?", args: [targetId] });

        const targetSocketId = onlineUsers.get(targetId);
        if (targetSocketId) {
          const targetSocket = io.sockets.sockets.get(targetSocketId);
          if (targetSocket) {
            targetSocket.emit("account_deleted", "Hesabınız yönetici tarafından kapatılmıştır.");
            targetSocket.disconnect(true);
          }
          onlineUsers.delete(targetId);
        }

        io.emit("user_deleted", { userId: targetId });
        io.emit("feed_updated");
        io.emit("friends_updated");
        if (cb) cb({ success: true, userId: targetId });
      } catch (err: any) {
        console.error("admin_delete_user error:", err);
        if (cb) cb({ error: "Kullanıcı silinirken bir hata oluştu." });
      }
    });

    // Chat
    socket.on("get_messages", async (friendId, cb) => {
      const msgRes = await client.execute({
        sql: "SELECT * FROM (SELECT * FROM messages WHERE (sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?) ORDER BY created_at DESC LIMIT 100) ORDER BY created_at ASC",
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
      let { receiver, type, content, reply_to, file_name, file_size } = data;
      if (type === "text") {
        if (!content || typeof content !== "string" || !content.trim()) return;
        content = content.trim();
        if (content.length > 1000) {
          content = content.slice(0, 1000);
        }
      }
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
      let { type, content, reply_to, file_name, file_size } = data;
      if (type === "text") {
        if (!content || typeof content !== "string" || !content.trim()) return;
        content = content.trim();
        if (content.length > 1000) {
          content = content.slice(0, 1000);
        }
      }
      const res = await client.execute({
        sql: "INSERT INTO global_messages (sender, type, content, reply_to, reactions, file_name, file_size, created_at) VALUES (?, ?, ?, ?, '[]', ?, ?, ?)",
        args: [user.id, type, content, reply_to || null, file_name || null, file_size || null, new Date().toISOString()]
      });
      const newMsgRes = await client.execute({ sql: "SELECT * FROM global_messages WHERE id = ?", args: [Number(res.lastInsertRowid)] });
      const popMsg = await populateMessage(newMsgRes.rows[0], "global");
      io.emit("new_global_message", popMsg);
    });

    socket.on("clear_global_chat", async () => {
      try {
        if (!user.username || user.username.trim().toLowerCase() !== 'emirgan') {
          return socket.emit("error_message", "Genel sohbeti temizleme yetkiniz bulunmuyor.");
        }
        await client.execute("DELETE FROM global_messages");
        io.emit("global_chat_cleared");
      } catch (err) {
        console.error("clear_global_chat error:", err);
      }
    });

    // Groups
    socket.on("get_groups", async (cb) => {
      const groupsRes = await client.execute("SELECT * FROM groups");
      const isEmirgan = user.username && user.username.trim().toLowerCase() === 'emirgan';
      const myGroups = groupsRes.rows.filter(g => {
         if (isEmirgan) return true;
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
        sql: "SELECT * FROM (SELECT * FROM group_messages WHERE group_id = ? ORDER BY created_at DESC LIMIT 100) ORDER BY created_at ASC",
        args: [groupId]
      });
      const populated = await Promise.all(msgsRes.rows.map((m: any) => populateMessage(m, "group")));
      cb(populated);
    });

    socket.on("send_group_message", async (data) => {
      let { group_id, type, content, reply_to, file_name, file_size } = data;
      if (type === "text") {
        if (!content || typeof content !== "string" || !content.trim()) return;
        content = content.trim();
        if (content.length > 1000) {
          content = content.slice(0, 1000);
        }
      }
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

    socket.on("change_password", async (data, cb) => {
      try {
        const u = await getUser(user.id);
        if (!u) return cb({ error: "User not found" });
        const isMatch = await bcrypt.compare(data.oldPassword, u.password as string);
        if (!isMatch) return cb({ error: "Eski şifre yanlış." });
        const newHash = await bcrypt.hash(data.newPassword, 10);
        await client.execute({ sql: "UPDATE users SET password = ? WHERE id = ?", args: [newHash, user.id] });
        cb({ success: true });
      } catch (err) {
        cb({ error: "Bir hata oluştu." });
      }
    });

    const handleDeleteMessage = async (data: any, cb?: (res: any) => void) => {
      let rawId: any = null;
      let requestedType = "";
      if (typeof data === "number" || typeof data === "string") {
        rawId = data;
      } else if (data && typeof data === "object") {
        rawId = data.message_id || data.id;
        requestedType = data.type || "";
      }
      
      const messageId = Number(rawId);
      if (!messageId || isNaN(messageId)) {
        if (cb) cb({ error: "Mesaj ID eksik." });
        return;
      }

      const isEmirgan = user.username && user.username.trim().toLowerCase() === 'emirgan';
      const currentUserId = Number(user.id);

      // Search tables: prioritize requestedType if given, otherwise search all 3 tables
      const tablesToTry = requestedType === "private"
        ? ["messages", "global_messages", "group_messages"]
        : requestedType === "group"
        ? ["group_messages", "messages", "global_messages"]
        : requestedType === "global"
        ? ["global_messages", "messages", "group_messages"]
        : ["messages", "global_messages", "group_messages"];

      let foundTable = "";
      let foundMsg: any = null;

      for (const tbl of tablesToTry) {
        try {
          const res = await client.execute({ sql: `SELECT * FROM ${tbl} WHERE id = ?`, args: [messageId] });
          if (res.rows.length > 0) {
            foundTable = tbl;
            foundMsg = res.rows[0];
            break;
          }
        } catch (e) {
          // ignore error
        }
      }

      if (!foundTable || !foundMsg) {
        if (cb) cb({ error: "Mesaj bulunamadı." });
        return;
      }

      const originalSender = Number(foundMsg.sender);
      // Backend yetki kontrolü: Kullanıcı mesajın sahibi değilse ve emirgan değilse işlemi reddet
      if (originalSender !== currentUserId && !isEmirgan) {
        if (cb) cb({ error: "Bu mesajı silme yetkiniz yok." });
        return;
      }

      try {
        // Kalıcı olarak DELETE FROM sorgusu ile sil
        await client.execute({ sql: `DELETE FROM ${foundTable} WHERE id = ?`, args: [messageId] });
        
        const resolvedType = foundTable === "messages" ? "private" : foundTable === "group_messages" ? "group" : "global";
        
        // Emit to all connected sockets
        io.emit("message_deleted", { 
          id: messageId,
          message_id: messageId, 
          type: resolvedType, 
          table: foundTable,
          group_id: foundMsg.group_id || data?.group_id, 
          receiver: foundMsg.receiver || data?.receiver 
        });

        if (cb) cb({ success: true, id: messageId, message_id: messageId });
      } catch (err) {
        console.error("Delete message error:", err);
        if (cb) cb({ error: "Silme işlemi sırasında hata oluştu." });
      }
    };

    socket.on("delete_message", (data, cb) => handleDeleteMessage(data, cb));
    socket.on("delete_global_message", (data, cb) => {
      if (typeof data === "number" || typeof data === "string") {
        handleDeleteMessage({ message_id: data, type: "global" }, cb);
      } else {
        handleDeleteMessage({ ...data, type: "global" }, cb);
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

    // --- Okey Game Logic ---
    const emitRooms = () => {
      const roomList = Array.from(okeyRooms.entries()).map(([id, room]) => ({
        id,
        name: room.name,
        gameMode: room.gameMode,
        players: room.players.length,
        status: room.status
      }));
      io.emit("okey_rooms_list", roomList);
    };

    socket.on("get_okey_rooms", () => {
      emitRooms();
    });

    socket.on("get_my_okey_room", () => {
      let targetRoomId = socket.data.currentOkeyRoom;
      if (!targetRoomId) {
        for (const [id, r] of okeyRooms.entries()) {
          if (r.players.some((p: any) => p.id === user.id)) {
            targetRoomId = id;
            break;
          }
        }
      }

      if (targetRoomId) {
        const room = okeyRooms.get(targetRoomId);
        if (room) {
          socket.data.currentOkeyRoom = targetRoomId;
          socket.join(`okey_${targetRoomId}`);
          const player = room.players.find((p: any) => p.id === user.id);
          if (player) {
            player.socketId = socket.id;
            socket.emit("okey_hand", player.hand || []);
          }
          socket.emit("okey_state", getSanitizedRoom(room));
        }
      }
    });

    socket.on("create_okey_room", ({ name }) => {
      const roomId = `room_${Date.now()}`;
      okeyRooms.set(roomId, {
        id: roomId,
        name: name || "Klasik Okey Masası",
        gameMode: "classic",
        status: "waiting",
        hostId: user.id,
        creatorId: user.id,
        players: [{
          id: user.id,
          username: user.username,
          avatar: user.avatar,
          color: user.color,
          socketId: socket.id,
          isBot: false,
          hand: [],
          discardPile: [],
          score: 0
        }],
        deck: [],
        indicator: null,
        okeyTile: null,
        currentTurn: 0,
        turnPhase: "draw",
        winnerId: null,
        winningReason: null,
        lastActionMessage: `${user.username} masayı kurdu.`
      });
      socket.join(`okey_${roomId}`);
      socket.data.currentOkeyRoom = roomId;
      emitRooms();
      socket.emit("okey_room_created", roomId);
      broadcastOkeyRoom(roomId);
    });

    socket.on("join_okey", (roomId) => {
      if (!roomId) return;
      let room = okeyRooms.get(roomId);
      if (!room) return;

      const existingPlayer = room.players.find((p: any) => p.id === user.id);
      if (!existingPlayer && room.players.length < 4 && room.status === 'waiting') {
        room.players.push({
          id: user.id,
          username: user.username,
          avatar: user.avatar,
          color: user.color,
          socketId: socket.id,
          isBot: false,
          hand: [],
          discardPile: [],
          score: 0
        });
        if (!room.hostId) {
          room.hostId = user.id;
        }
      } else if (existingPlayer) {
        existingPlayer.socketId = socket.id;
        if (room.status === 'playing') {
          socket.emit("okey_hand", existingPlayer.hand || []);
        }
      }

      socket.join(`okey_${roomId}`);
      socket.data.currentOkeyRoom = roomId;
      broadcastOkeyRoom(roomId);
      emitRooms();
    });

    socket.on("start_okey_game", (roomId) => {
      const room = okeyRooms.get(roomId);
      if (!room || (room.status !== 'waiting' && room.status !== 'ended')) return;

      // Only table host can deal tiles and start game
      if (room.hostId && room.hostId !== user.id) {
        return socket.emit("okey_error", "Yalnızca masa yöneticisi (Host) taşları dağıtabilir.");
      }

      // Clear any pending bot timers
      if (room.botTimeout) {
        clearTimeout(room.botTimeout);
        room.botTimeout = null;
      }

      // Auto-fill empty seats with Bots up to 4 players so game can always start
      const botNames = [
        { username: 'Zeynep (Bot)', color: '#ec4899' },
        { username: 'Ahmet (Bot)', color: '#3b82f6' },
        { username: 'Mehmet (Bot)', color: '#10b981' }
      ];
      let bIdx = 0;
      while (room.players.length < 4 && bIdx < botNames.length) {
        const b = botNames[bIdx];
        room.players.push({
          id: -100 - (bIdx + 1),
          username: b.username,
          avatar: null,
          color: b.color,
          isBot: true,
          hand: [],
          discardPile: [],
          score: 0
        });
        bIdx++;
      }

      // Completely clear previous hands and discard piles for all players
      for (const p of room.players) {
        p.hand = [];
        p.discardPile = [];
      }

      // Generate 106 shuffled deck & determine Okey
      const { deck, indicator, okeyTile } = generateDeck();
      room.deck = deck;
      room.indicator = indicator;
      room.okeyTile = okeyTile;
      room.status = 'playing';
      room.currentTurn = 0;
      room.turnPhase = 'discard'; // Starting player starts with 15 tiles and throws first!
      room.winnerId = null;
      room.winningReason = null;
      room.lastActionMessage = `Taşlar dağıtıldı! Gösterge: ${indicator.number} (${indicator.color}). Okey: ${okeyTile.number} (${okeyTile.color}). Sıra ${room.players[0].username} oyuncusunda.`;

      // Strictly deal 15 tiles to 1st player, 14 tiles to other 3 players
      for (let i = 0; i < room.players.length; i++) {
        const count = i === 0 ? 15 : 14;
        room.players[i].hand = room.deck.splice(0, count);
        room.players[i].discardPile = [];
      }

      broadcastOkeyRoom(roomId);
      emitRooms();

      if (room.players[0].isBot) {
        runBotTurn(roomId);
      }
    });

    socket.on("okey_draw", ({ source }: { source: 'deck' | 'discard' }) => {
      const roomId = socket.data.currentOkeyRoom;
      if (!roomId) return;
      const room = okeyRooms.get(roomId);
      if (!room || room.status !== 'playing') return;

      const playerIdx = room.players.findIndex((p: any) => p.id === user.id);
      if (playerIdx === -1 || room.currentTurn !== playerIdx || room.turnPhase !== 'draw') {
        return socket.emit("okey_error", "Şu an taş çekme sırası sizde değil.");
      }

      const player = room.players[playerIdx];
      if (source === 'deck') {
        if (room.deck.length === 0) {
          return socket.emit("okey_error", "Destede çekilecek taş kalmadı!");
        }
        const drawn = room.deck.pop();
        if (drawn) {
          player.hand.push(drawn);
          room.lastActionMessage = `${user.username} desteden taş çekti.`;
        }
      } else if (source === 'discard') {
        const prevIdx = (playerIdx + room.players.length - 1) % room.players.length;
        const prevPlayer = room.players[prevIdx];
        if (!prevPlayer || !prevPlayer.discardPile || prevPlayer.discardPile.length === 0) {
          return socket.emit("okey_error", "Yandan çekilebilecek taş bulunmuyor.");
        }
        const drawn = prevPlayer.discardPile.pop();
        if (drawn) {
          player.hand.push(drawn);
          room.lastActionMessage = `${user.username} yandan atılan taşı çekti.`;
        }
      }

      room.turnPhase = 'discard';
      broadcastOkeyRoom(roomId);
    });

    socket.on("okey_discard", (tile: any) => {
      const roomId = socket.data.currentOkeyRoom;
      if (!roomId) return;
      const room = okeyRooms.get(roomId);
      if (!room || room.status !== 'playing') return;

      const playerIdx = room.players.findIndex((p: any) => p.id === user.id);
      if (playerIdx === -1 || room.currentTurn !== playerIdx || room.turnPhase !== 'discard') {
        return socket.emit("okey_error", "Şu an taş atma sırası sizde değil.");
      }

      const player = room.players[playerIdx];
      const handIdx = player.hand.findIndex((t: any) => t.id === tile.id);
      if (handIdx === -1) {
        return socket.emit("okey_error", "Atmak istediğiniz taş elinizde yok.");
      }

      const discarded = player.hand.splice(handIdx, 1)[0];
      player.discardPile.push(discarded);
      const colorText = discarded.color === 'red' ? 'Kırmızı' : discarded.color === 'blue' ? 'Mavi' : discarded.color === 'black' ? 'Siyah' : 'Sarı';
      room.lastActionMessage = `${user.username} ${discarded.number} ${colorText} attı.`;

      // Next player's turn
      room.currentTurn = (room.currentTurn + 1) % room.players.length;
      room.turnPhase = 'draw';
      broadcastOkeyRoom(roomId);

      if (room.players[room.currentTurn]?.isBot) {
        runBotTurn(roomId);
      }
    });

    socket.on("okey_declare_win", (data?: { discardTileId?: string }) => {
      const roomId = socket.data.currentOkeyRoom;
      if (!roomId) return;
      const room = okeyRooms.get(roomId);
      if (!room || room.status !== 'playing') return;

      const playerIdx = room.players.findIndex((p: any) => p.id === user.id);
      if (playerIdx === -1 || room.currentTurn !== playerIdx) {
        return socket.emit("okey_error", "Sıra sizde değil.");
      }

      const player = room.players[playerIdx];
      const winCheck = checkClassicOkeyWin(player.hand, room.okeyTile, data?.discardTileId);
      if (!winCheck.canWin) {
        return socket.emit("okey_error", winCheck.reason || "Eliniz kurallara uygun bitmiyor. 14 taş per veya 7 çift olmalıdır.");
      }

      // If discard was part of winning (15th tile thrown to finish)
      if (winCheck.discardTileId) {
        const dIdx = player.hand.findIndex((t: any) => t.id === winCheck.discardTileId);
        if (dIdx !== -1) {
          const finishTile = player.hand.splice(dIdx, 1)[0];
          player.discardPile.push(finishTile);
        }
      }

      room.status = 'ended';
      room.winnerId = user.id;
      room.winningReason = `${user.username} ${winCheck.reason || 'elini bitirdi ve oyunu kazandı!'} 🏆`;
      room.lastActionMessage = `${user.username} oyunu kazandı! 🏆`;

      client.execute({
        sql: "UPDATE users SET okey_wins = COALESCE(okey_wins, 0) + 1 WHERE id = ?",
        args: [user.id]
      }).catch(console.error);

      broadcastOkeyRoom(roomId);
      emitRooms();
    });

    socket.on("leave_okey", () => {
      const roomId = socket.data.currentOkeyRoom;
      if (roomId) {
        socket.leave(`okey_${roomId}`);
        const room = okeyRooms.get(roomId);
        if (room) {
          const wasHost = room.hostId === user.id;
          room.players = room.players.filter((p: any) => p.id !== user.id);
          if (room.players.length === 0 || room.players.every((p: any) => p.isBot)) {
            clearTimeout(room.botTimeout);
            okeyRooms.delete(roomId);
          } else {
            if (wasHost) {
              const nextRealPlayer = room.players.find((p: any) => !p.isBot);
              if (nextRealPlayer) {
                room.hostId = nextRealPlayer.id;
                room.creatorId = nextRealPlayer.id;
                room.lastActionMessage = `Masa yöneticisi ayrıldı. Yeni yönetici: ${nextRealPlayer.username}`;
              }
            }
            broadcastOkeyRoom(roomId);
          }
          emitRooms();
        }
        socket.data.currentOkeyRoom = null;
      }
    });

    // --- UNO Socket Events (Completely Isolated from Okey) ---
    socket.on("get_uno_rooms", () => {
      emitUnoRoomsList();
    });

    socket.on("get_my_uno_room", () => {
      let targetRoomId = socket.data.currentUnoRoom;
      if (!targetRoomId) {
        for (const [id, r] of unoRooms.entries()) {
          if (r.players.some((p: any) => p.id === user.id)) {
            targetRoomId = id;
            break;
          }
        }
      }

      if (targetRoomId) {
        const room = unoRooms.get(targetRoomId);
        if (room) {
          socket.data.currentUnoRoom = targetRoomId;
          socket.join(`uno_${targetRoomId}`);
          const p = room.players.find((pl: any) => pl.id === user.id);
          if (p) p.socketId = socket.id;
          socket.emit("uno_state", getSanitizedUnoRoom(room));
          if (p && p.hand) {
            socket.emit("uno_hand", p.hand);
          }
        }
      }
    });

    socket.on("uno_create_room", (data: { name: string }) => {
      const roomId = crypto.randomUUID();
      const newRoom = {
        id: roomId,
        name: (data?.name || "UNO Masası").trim().slice(0, 30),
        status: 'waiting',
        hostId: user.id,
        creatorId: user.id,
        players: [{
          id: user.id,
          username: user.username,
          avatar: user.avatar,
          color: user.color,
          isBot: false,
          socketId: socket.id,
          hand: [],
          hasCalledUno: false,
          score: 0
        }],
        deck: [],
        discardPile: [],
        topCard: null,
        activeColor: 'red',
        direction: 1,
        currentTurn: 0,
        winnerId: null,
        lastActionMessage: `${user.username} masayı kurdu. Diğer oyuncular veya botlar bekleniyor.`
      };

      unoRooms.set(roomId, newRoom);
      socket.data.currentUnoRoom = roomId;
      socket.join(`uno_${roomId}`);

      socket.emit("uno_room_created", roomId);
      broadcastUnoRoom(roomId);
      emitUnoRoomsList();
    });

    socket.on("uno_join_room", (roomId: string) => {
      const room = unoRooms.get(roomId);
      if (!room) return socket.emit("uno_error", "Masa bulunamadı.");
      if (room.status !== 'waiting' && !room.players.some((p: any) => p.id === user.id)) {
        return socket.emit("uno_error", "Oyun zaten başlamış.");
      }
      if (room.players.length >= 4 && !room.players.some((p: any) => p.id === user.id)) {
        return socket.emit("uno_error", "Masa dolu (Maksimum 4 oyuncu).");
      }

      socket.data.currentUnoRoom = roomId;
      socket.join(`uno_${roomId}`);

      const existingPlayer = room.players.find((p: any) => p.id === user.id);
      if (!existingPlayer) {
        room.players.push({
          id: user.id,
          username: user.username,
          avatar: user.avatar,
          color: user.color,
          isBot: false,
          socketId: socket.id,
          hand: [],
          hasCalledUno: false,
          score: 0
        });
        room.lastActionMessage = `${user.username} masaya katıldı.`;
      } else {
        existingPlayer.socketId = socket.id;
      }

      broadcastUnoRoom(roomId);
      emitUnoRoomsList();
    });

    socket.on("uno_add_bot", () => {
      const roomId = socket.data.currentUnoRoom;
      if (!roomId) return;
      const room = unoRooms.get(roomId);
      if (!room || room.hostId !== user.id || room.status !== 'waiting') return;
      if (room.players.length >= 4) return socket.emit("uno_error", "Masa dolu.");

      const botNames = ["Bot Aylin", "Bot Can", "Bot Deniz", "Bot Efe", "Bot Zeynep", "Bot Mert"];
      const usedNames = new Set(room.players.map((p: any) => p.username));
      const availableName = botNames.find(n => !usedNames.has(n)) || `Bot ${room.players.length + 1}`;
      const botId = -Date.now() - Math.floor(Math.random() * 1000);

      room.players.push({
        id: botId,
        username: availableName,
        avatar: null,
        color: '#6366f1',
        isBot: true,
        hand: [],
        hasCalledUno: false,
        score: 0
      });

      room.lastActionMessage = `${availableName} masaya eklendi.`;
      broadcastUnoRoom(roomId);
      emitUnoRoomsList();
    });

    socket.on("uno_remove_bot", () => {
      const roomId = socket.data.currentUnoRoom;
      if (!roomId) return;
      const room = unoRooms.get(roomId);
      if (!room || room.hostId !== user.id || room.status !== 'waiting') return;

      const lastBotIdx = room.players.map((p: any) => p.isBot).lastIndexOf(true);
      if (lastBotIdx !== -1) {
        const removed = room.players.splice(lastBotIdx, 1)[0];
        room.lastActionMessage = `${removed.username} masadan çıkarıldı.`;
        broadcastUnoRoom(roomId);
        emitUnoRoomsList();
      }
    });

    socket.on("uno_start_game", () => {
      const roomId = socket.data.currentUnoRoom;
      if (!roomId) return;
      const room = unoRooms.get(roomId);
      if (!room || room.hostId !== user.id || room.status !== 'waiting') return;
      if (room.players.length < 2) return socket.emit("uno_error", "Oyunu başlatmak için en az 2 oyuncu gerekir.");

      // Create 108 card deck
      const fullDeck = createUnoDeck();
      room.deck = fullDeck;
      room.discardPile = [];

      // Deal 7 cards to each player
      for (const p of room.players) {
        p.hand = room.deck.splice(0, 7);
        p.hasCalledUno = false;
      }

      // Flip starting top card (draw until a number card 0-9 for clean start)
      let firstCard = room.deck.pop()!;
      while (firstCard.color === 'wild' || ['skip', 'reverse', 'draw2', 'wild', 'wild4'].includes(firstCard.value)) {
        room.deck.unshift(firstCard);
        firstCard = room.deck.pop()!;
      }

      room.topCard = firstCard;
      room.activeColor = firstCard.color;
      room.direction = 1;
      room.currentTurn = 0;
      room.status = 'playing';
      room.winnerId = null;
      room.lastActionMessage = `UNO başladı! İlk kart: ${COLOR_STYLES[firstCard.color]?.label || firstCard.color} ${firstCard.value}`;

      broadcastUnoRoom(roomId);
      emitUnoRoomsList();

      if (room.players[0]?.isBot) {
        runBotTurnUno(roomId);
      }
    });

    socket.on("uno_play_card", (data: { cardId: string; chosenColor?: UnoColor }) => {
      const roomId = socket.data.currentUnoRoom;
      if (!roomId) return;
      const room = unoRooms.get(roomId);
      if (!room || room.status !== 'playing') return;

      const currentPlayer = room.players[room.currentTurn];
      if (!currentPlayer || currentPlayer.id !== user.id) {
        return socket.emit("uno_error", "Sıra sizde değil.");
      }

      const card = currentPlayer.hand.find((c: UnoCard) => c.id === data.cardId);
      if (!card) return socket.emit("uno_error", "Kart elinizde bulunamadı.");

      if (!isCardPlayable(card, room.topCard, room.activeColor)) {
        return socket.emit("uno_error", "Bu kart şu an oynanamaz! Renk veya sayı eşleşmeli.");
      }

      executePlayUnoCard(room, currentPlayer, data.cardId, data.chosenColor);
    });

    socket.on("uno_draw_card", () => {
      const roomId = socket.data.currentUnoRoom;
      if (!roomId) return;
      const room = unoRooms.get(roomId);
      if (!room || room.status !== 'playing') return;

      const currentPlayer = room.players[room.currentTurn];
      if (!currentPlayer || currentPlayer.id !== user.id) {
        return socket.emit("uno_error", "Sıra sizde değil.");
      }

      const drawnCards = drawCardsFromUnoDeck(room, 1);
      if (drawnCards.length > 0) {
        const drawn = drawnCards[0];
        currentPlayer.hand.push(drawn);
        
        // If the drawn card is playable, allow player to play it or pass
        if (isCardPlayable(drawn, room.topCard, room.activeColor)) {
          room.lastActionMessage = `${currentPlayer.username} kart çekti. Oynayabilir veya Pas geçebilir!`;
          broadcastUnoRoom(roomId);
        } else {
          // If not playable, advance turn automatically
          advanceUnoTurn(room, 1);
          room.lastActionMessage = `${currentPlayer.username} kart çekti ve pas geçti.`;
          broadcastUnoRoom(roomId);

          const nextP = room.players[room.currentTurn];
          if (nextP && nextP.isBot) {
            runBotTurnUno(roomId);
          }
        }
      }
    });

    socket.on("uno_pass_turn", () => {
      const roomId = socket.data.currentUnoRoom;
      if (!roomId) return;
      const room = unoRooms.get(roomId);
      if (!room || room.status !== 'playing') return;

      const currentPlayer = room.players[room.currentTurn];
      if (!currentPlayer || currentPlayer.id !== user.id) return;

      advanceUnoTurn(room, 1);
      room.lastActionMessage = `${currentPlayer.username} pas geçti.`;
      broadcastUnoRoom(roomId);

      const nextP = room.players[room.currentTurn];
      if (nextP && nextP.isBot) {
        runBotTurnUno(roomId);
      }
    });

    socket.on("uno_call_uno", () => {
      const roomId = socket.data.currentUnoRoom;
      if (!roomId) return;
      const room = unoRooms.get(roomId);
      if (!room || room.status !== 'playing') return;

      const player = room.players.find((p: any) => p.id === user.id);
      if (!player) return;

      player.hasCalledUno = true;
      room.lastActionMessage = `🔥 ${player.username}: "UNO!" 🎴`;
      broadcastUnoRoom(roomId);
    });

    socket.on("uno_restart_game", () => {
      const roomId = socket.data.currentUnoRoom;
      if (!roomId) return;
      const room = unoRooms.get(roomId);
      if (!room || room.hostId !== user.id || room.status !== 'ended') return;

      const fullDeck = createUnoDeck();
      room.deck = fullDeck;
      room.discardPile = [];
      for (const p of room.players) {
        p.hand = room.deck.splice(0, 7);
        p.hasCalledUno = false;
      }
      let firstCard = room.deck.pop()!;
      while (firstCard.color === 'wild' || ['skip', 'reverse', 'draw2', 'wild', 'wild4'].includes(firstCard.value)) {
        room.deck.unshift(firstCard);
        firstCard = room.deck.pop()!;
      }
      room.topCard = firstCard;
      room.activeColor = firstCard.color;
      room.direction = 1;
      room.currentTurn = 0;
      room.status = 'playing';
      room.winnerId = null;
      room.lastActionMessage = `Yeni UNO turu başladı! İlk kart: ${COLOR_STYLES[firstCard.color]?.label || firstCard.color} ${firstCard.value}`;

      broadcastUnoRoom(roomId);
      emitUnoRoomsList();

      if (room.players[0]?.isBot) {
        runBotTurnUno(roomId);
      }
    });

    socket.on("uno_leave_room", () => {
      const roomId = socket.data.currentUnoRoom;
      if (roomId) {
        socket.leave(`uno_${roomId}`);
        const room = unoRooms.get(roomId);
        if (room) {
          const wasHost = room.hostId === user.id;
          room.players = room.players.filter((p: any) => p.id !== user.id);
          if (room.players.length === 0 || room.players.every((p: any) => p.isBot)) {
            clearTimeout(room.botTimeout);
            unoRooms.delete(roomId);
          } else {
            if (wasHost) {
              const nextReal = room.players.find((p: any) => !p.isBot);
              if (nextReal) {
                room.hostId = nextReal.id;
                room.creatorId = nextReal.id;
                room.lastActionMessage = `Masa yöneticisi ayrıldı. Yeni yönetici: ${nextReal.username}`;
              }
            }
            broadcastUnoRoom(roomId);
          }
          emitUnoRoomsList();
        }
        socket.data.currentUnoRoom = null;
      }
    });

    socket.on("disconnect", async () => {
      const unoRoomId = socket.data.currentUnoRoom;
      if (unoRoomId) {
        const room = unoRooms.get(unoRoomId);
        if (room && room.status === 'waiting') {
          const wasHost = room.hostId === user.id;
          room.players = room.players.filter((p: any) => p.id !== user.id);
          if (room.players.length === 0 || room.players.every((p: any) => p.isBot)) {
            unoRooms.delete(unoRoomId);
          } else {
            if (wasHost) {
              const nextReal = room.players.find((p: any) => !p.isBot);
              if (nextReal) {
                room.hostId = nextReal.id;
                room.creatorId = nextReal.id;
                room.lastActionMessage = `Masa yöneticisi ayrıldı. Yeni yönetici: ${nextReal.username}`;
              }
            }
            broadcastUnoRoom(unoRoomId);
          }
          emitUnoRoomsList();
        }
      }
      const roomId = socket.data.currentOkeyRoom;
      if (roomId) {
        const room = okeyRooms.get(roomId);
        // Only remove player if waiting in lobby, NOT if actively playing!
        if (room && room.status === 'waiting') {
          const wasHost = room.hostId === user.id;
          room.players = room.players.filter((p: any) => p.id !== user.id);
          if (room.players.length === 0 || room.players.every((p: any) => p.isBot)) {
            okeyRooms.delete(roomId);
          } else {
            if (wasHost) {
              const nextRealPlayer = room.players.find((p: any) => !p.isBot);
              if (nextRealPlayer) {
                room.hostId = nextRealPlayer.id;
                room.creatorId = nextRealPlayer.id;
                room.lastActionMessage = `Masa yöneticisi ayrıldı. Yeni yönetici: ${nextRealPlayer.username}`;
              }
            }
            broadcastOkeyRoom(roomId);
          }
          emitRooms();
        }
      }
      
      await client.execute({
        sql: "UPDATE users SET last_seen = ? WHERE id = ?",
        args: [new Date().toISOString(), user.id]
      });

      // Mobile network reconnection grace period:
      // Don't drop user from online status immediately on momentary disconnect (e.g. backgrounding tab, cellular handover)
      // If user reconnects within 20 seconds, their presence is uninterrupted!
      if (onlineUsers.get(userIdNum) === socket.id) {
        const timer = setTimeout(() => {
          disconnectTimers.delete(userIdNum);
          if (onlineUsers.get(userIdNum) === socket.id) {
            onlineUsers.delete(userIdNum);
            io.emit("online_users", Array.from(onlineUsers.keys()));
          }
        }, 20000); // 20s grace period for mobile reconnection
        disconnectTimers.set(userIdNum, timer);
      }
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
