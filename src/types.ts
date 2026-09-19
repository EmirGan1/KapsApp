export interface User {
  id: number;
  username: string;
  avatar: string | null;
  color?: string;
  token?: string;
  last_seen: string;
  signup_ip?: string | null;
  last_ip?: string | null;
}

export interface Post {
  id: number;
  user_id: number;
  username: string;
  avatar: string | null;
  color?: string;
  image: string | null;
  media_type?: 'image' | 'video' | 'file';
  caption: string;
  created_at: string;
  likes_count: number;
  is_liked: boolean;
  comments?: Comment[];
  likes?: any[];
}

export interface Comment {
  id: number;
  post_id: number;
  user_id: number;
  username: string;
  avatar: string | null;
  color?: string;
  content: string;
  created_at: string;
}

export interface Story {
  id: number;
  user_id: number;
  username: string;
  avatar: string | null;
  color?: string;
  image: string;
  media_type?: 'image' | 'video';
  created_at: string;
}

export interface MessageReaction {
  user_id: number;
  emoji: string;
}

export interface Message {
  id: number;
  sender: number;
  receiver: number;
  group_id?: number;
  sender_name?: string;
  sender_avatar?: string;
  sender_color?: string;
  type: 'text' | 'image' | 'video' | 'voice' | 'file';
  content: string;
  file_name?: string;
  file_size?: string;
  reply_to?: number;
  reply_message?: Message;
  reactions?: MessageReaction[];
  created_at: string;
}

export interface Friend {
  id: number;
  username: string;
  avatar: string | null;
  color?: string;
  status: 0 | 1; // 0 = pending, 1 = accepted
  is_sender: boolean; // Did current user send the request?
  signup_ip?: string | null;
  last_ip?: string | null;
  lastMessageText?: string | null;
  lastMessageTime?: string | null;
  lastMessageSender?: number | null;
  unreadCount?: number;
}

export interface TableChatMessage {
  id: string | number;
  senderId: number;
  username: string;
  avatar?: string | null;
  color?: string | null;
  text: string;
  time: string;
}

export interface AppNotification {
  id: number;
  user_id: number;
  type: 'new_message' | 'dm' | 'like' | 'comment' | 'follow' | 'friend_request' | 'friend_accept' | 'group_invite' | 'new_group_message' | string;
  content: string;
  read: number;
  sender_id?: number | null;
  target_id?: number | null;
  created_at: string;
}

export interface UserProfileData {
  id: number;
  username: string;
  avatar: string | null;
  color?: string;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  friendStatus?: 'none' | 'pending_sent' | 'pending_received' | 'friends';
  signup_ip?: string | null;
  last_ip?: string | null;
}

export interface MediaModalData {
  url: string;
  type: 'image' | 'video';
  authorName?: string;
  authorAvatar?: string | null;
  authorColor?: string;
  authorId?: number;
  caption?: string;
  timestamp?: string;
  postId?: number;
  likesCount?: number;
  isLiked?: boolean;
  comments?: Comment[];
  fileName?: string;
  fileSize?: string;
  reactions?: MessageReaction[];
  onLike?: () => void;
  onAddComment?: (text: string) => void;
}

export interface VoiceParticipant {
  id: number;
  username: string;
  avatar: string | null;
  color?: string;
  socketId: string;
  isHost: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
  isDeafened?: boolean;
  isVideoOff?: boolean;
  joinedAt: string;
}

export interface VoiceRoom {
  id: string;
  name: string;
  hostId: number;
  hostUsername: string;
  maxParticipants: number;
  participants: VoiceParticipant[];
  createdAt: string;
}

export interface DrawGuessPlayer {
  id: number;
  username: string;
  avatar: string | null;
  color?: string;
  score: number;
  roundScore: number;
  hasGuessed: boolean;
  isDrawing: boolean;
  isHost: boolean;
  socketId: string;
}

export interface DrawGuessRoom {
  id: string;
  name: string;
  hostId: number;
  hostUsername: string;
  maxPlayers: number;
  totalRounds: number;
  currentRound: number;
  currentDrawerIndex: number;
  drawerId: number | null;
  drawerUsername: string | null;
  status: 'lobby' | 'choosing' | 'drawing' | 'round_end' | 'game_over';
  currentWord?: string; // only revealed to drawer or at round end
  wordMask?: string; // e.g. "_ _ _ _ _"
  wordLength?: number;
  wordChoices?: { word: string; difficulty: 'easy' | 'medium' | 'hard'; points: number }[];
  timer: number;
  roundDuration: number;
  players: DrawGuessPlayer[];
  lastRoundWinner?: string | null;
  revealedWord?: string | null;
  createdAt: string;
}

export interface DrawLineData {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  size: number;
  isEraser?: boolean;
}

export interface DrawGuessChatMessage {
  id: string;
  userId: number;
  username: string;
  text: string;
  isSystem?: boolean;
  isCorrect?: boolean;
  createdAt: string;
}
