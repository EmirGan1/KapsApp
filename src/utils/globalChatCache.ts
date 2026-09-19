// In-memory client cache for Global Chat (Stale-While-Revalidate & Instant 0ms Load)
export interface GlobalChatCache {
  messages: any[];
  users: any[];
  readReceipts: { [userId: number]: number };
  lastFetchedAt: string | null;
}

export const globalChatCache: GlobalChatCache = {
  messages: [],
  users: [],
  readReceipts: {},
  lastFetchedAt: null,
};

export function appendToGlobalCache(msg: any) {
  if (!msg || !msg.id) return;
  const exists = globalChatCache.messages.some(m => m.id === msg.id);
  if (!exists) {
    globalChatCache.messages.push(msg);
  }
}

export function updateGlobalCacheReactions(messageId: number, reactions: any[]) {
  globalChatCache.messages = globalChatCache.messages.map(m => 
    m.id === messageId ? { ...m, reactions } : m
  );
}

export function removeFromGlobalCache(messageId: string | number) {
  const strId = String(messageId);
  globalChatCache.messages = globalChatCache.messages.filter(m => String(m.id) !== strId);
}

export function clearGlobalCache() {
  globalChatCache.messages = [];
  globalChatCache.lastFetchedAt = null;
}
