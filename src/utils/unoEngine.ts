export type UnoColor = 'red' | 'blue' | 'green' | 'yellow' | 'wild';
export type UnoValue = 
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' 
  | 'draw2' | 'reverse' | 'skip' | 'wild' | 'wild4';

export interface UnoCard {
  id: string;
  color: UnoColor;
  value: UnoValue;
}

export interface UnoPlayer {
  id: number;
  username: string;
  avatar?: string | null;
  color?: string | null;
  isBot?: boolean;
  cardCount: number;
  hasCalledUno?: boolean;
  score?: number;
}

export interface UnoRoomState {
  id: string;
  name: string;
  status: 'waiting' | 'playing' | 'ended';
  hostId: number;
  creatorId: number;
  players: UnoPlayer[];
  deckCount: number;
  topCard: UnoCard | null;
  activeColor: UnoColor;
  direction: 1 | -1; // 1: clockwise, -1: counter-clockwise
  currentTurn: number; // index in players array
  winnerId?: number | null;
  lastActionMessage?: string;
  discardPileCount?: number;
}

// Generates a full standard 108-card UNO deck
export function createUnoDeck(): UnoCard[] {
  const deck: UnoCard[] = [];
  const colors: ('red' | 'blue' | 'green' | 'yellow')[] = ['red', 'blue', 'green', 'yellow'];
  let cardCounter = 1;

  for (const color of colors) {
    // One 0 card per color
    deck.push({
      id: `c_${cardCounter++}`,
      color,
      value: '0'
    });

    // Two 1-9 cards per color
    for (let i = 1; i <= 9; i++) {
      deck.push({ id: `c_${cardCounter++}`, color, value: `${i}` as UnoValue });
      deck.push({ id: `c_${cardCounter++}`, color, value: `${i}` as UnoValue });
    }

    // Two Draw 2 (+2) cards per color
    deck.push({ id: `c_${cardCounter++}`, color, value: 'draw2' });
    deck.push({ id: `c_${cardCounter++}`, color, value: 'draw2' });

    // Two Reverse cards per color
    deck.push({ id: `c_${cardCounter++}`, color, value: 'reverse' });
    deck.push({ id: `c_${cardCounter++}`, color, value: 'reverse' });

    // Two Skip cards per color
    deck.push({ id: `c_${cardCounter++}`, color, value: 'skip' });
    deck.push({ id: `c_${cardCounter++}`, color, value: 'skip' });
  }

  // 4 Wild cards
  for (let i = 0; i < 4; i++) {
    deck.push({ id: `c_${cardCounter++}`, color: 'wild', value: 'wild' });
  }

  // 4 Wild Draw 4 (+4) cards
  for (let i = 0; i < 4; i++) {
    deck.push({ id: `c_${cardCounter++}`, color: 'wild', value: 'wild4' });
  }

  return shuffleCards(deck);
}

export function shuffleCards<T>(cards: T[]): T[] {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Checks if a card is valid to play on top of current active state
export function isCardPlayable(card: UnoCard, topCard: UnoCard | null, activeColor: UnoColor): boolean {
  if (!topCard) return true;
  // Wild cards can always be played
  if (card.color === 'wild' || card.value === 'wild' || card.value === 'wild4') {
    return true;
  }
  // Matches active color
  if (card.color === activeColor) {
    return true;
  }
  // Matches value/face
  if (card.value === topCard.value) {
    return true;
  }
  return false;
}

// Color labels and styling helpers
export const COLOR_STYLES: Record<string, { bg: string; text: string; border: string; label: string; ring: string }> = {
  red: {
    bg: 'bg-rose-600',
    text: 'text-rose-500',
    border: 'border-rose-500',
    label: 'Kırmızı',
    ring: 'ring-rose-500'
  },
  blue: {
    bg: 'bg-sky-600',
    text: 'text-sky-400',
    border: 'border-sky-500',
    label: 'Mavi',
    ring: 'ring-sky-500'
  },
  green: {
    bg: 'bg-emerald-600',
    text: 'text-emerald-400',
    border: 'border-emerald-500',
    label: 'Yeşil',
    ring: 'ring-emerald-500'
  },
  yellow: {
    bg: 'bg-amber-400',
    text: 'text-amber-300',
    border: 'border-amber-400',
    label: 'Sarı',
    ring: 'ring-amber-400'
  },
  wild: {
    bg: 'bg-gradient-to-br from-rose-500 via-amber-400 to-sky-500',
    text: 'text-white',
    border: 'border-purple-400',
    label: 'Joker',
    ring: 'ring-purple-500'
  }
};
