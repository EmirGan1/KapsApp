export interface User {
  id: number;
  username: string;
  avatar: string | null;
  color?: string;
  token?: string;
  last_seen: string;
}

export interface Post {
  id: number;
  user_id: number;
  username: string;
  avatar: string | null;
  color?: string;
  image: string | null;
  caption: string;
  created_at: string;
  likes_count: number;
  is_liked: boolean;
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
  sender_name?: string;
  sender_avatar?: string;
  sender_color?: string;
  type: 'text' | 'image' | 'voice';
  content: string;
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
}
