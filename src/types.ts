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
