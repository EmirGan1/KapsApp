export type TileColor = 'red' | 'blue' | 'black' | 'yellow' | 'fake';

export interface Tile {
  id: string;
  number: number; // 1-13, 0 for fake okey
  color: TileColor;
  isOkey?: boolean;
  isFake?: boolean;
}

export interface OkeyPlayer {
  id: number;
  username: string;
  avatar?: string | null;
  color?: string | null;
  isBot?: boolean;
  tileCount: number;
  discardPile: Tile[];
  score: number;
}

export interface OkeyRoomState {
  id: string;
  name: string;
  gameMode: 'classic';
  status: 'waiting' | 'playing' | 'ended';
  creatorId: number;
  players: OkeyPlayer[];
  deckCount: number;
  indicator: Tile | null;
  okeyTile: Tile | null;
  currentTurn: number;
  turnPhase: 'draw' | 'discard';
  winnerId: number | null;
  winningReason: string | null;
  lastActionMessage?: string;
}

// 1. Deck & Okey Generator (Standard 106 tiles)
export const generateDeck = (): { deck: Tile[]; indicator: Tile; okeyTile: Tile } => {
  const colors: TileColor[] = ['red', 'blue', 'black', 'yellow'];
  const allTiles: Tile[] = [];
  let idCount = 1;

  // 104 regular tiles (2 sets of 1-13 in 4 colors)
  for (const color of colors) {
    for (let num = 1; num <= 13; num++) {
      allTiles.push({ id: `t_${idCount++}`, number: num, color });
      allTiles.push({ id: `t_${idCount++}`, number: num, color });
    }
  }

  // Two fake okeys
  allTiles.push({ id: `t_${idCount++}`, number: 0, color: 'fake', isFake: true });
  allTiles.push({ id: `t_${idCount++}`, number: 0, color: 'fake', isFake: true });

  // Shuffle Fisher-Yates
  for (let i = allTiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allTiles[i], allTiles[j]] = [allTiles[j], allTiles[i]];
  }

  // Draw indicator: must not be fake okey
  let indicatorIdx = allTiles.findIndex(t => !t.isFake);
  if (indicatorIdx === -1) indicatorIdx = 0;
  const indicator = allTiles.splice(indicatorIdx, 1)[0];

  // Calculate Okey: same color, next number (13 -> 1)
  const okeyNumber = indicator.number === 13 ? 1 : indicator.number + 1;
  const okeyTile: Tile = {
    id: 'okey_ref',
    number: okeyNumber,
    color: indicator.color,
    isOkey: true,
  };

  // Mark real okeys and assign fake okey values
  for (const t of allTiles) {
    if (t.isFake) {
      // Fake okey takes the place of the real okey's face value
      t.number = okeyTile.number;
      t.color = okeyTile.color;
    } else if (t.color === okeyTile.color && t.number === okeyTile.number) {
      t.isOkey = true;
    }
  }

  return { deck: allTiles, indicator, okeyTile };
};

// 2. Serial Meld Validation (e.g. Red 4-5-6 or 11-12-13 or 12-13-1)
export const isSerialMeld = (tiles: Tile[], okeyRef?: Tile | null): boolean => {
  if (tiles.length < 3) return false;

  const jokers = tiles.filter(t => t.isOkey);
  const regulars = tiles.filter(t => !t.isOkey);

  if (regulars.length === 0) return true; // All jokers

  // Regular tiles must all be same color
  const color = regulars[0].color;
  if (regulars.some(t => t.color !== color)) return false;

  const nums = regulars.map(t => t.number);
  const uniqueNums = new Set(nums);
  if (uniqueNums.size !== nums.length) return false;

  const sorted = [...nums].sort((a, b) => a - b);

  const canFormSequence = (arr: number[], numJokers: number): boolean => {
    let needed = 0;
    for (let i = 0; i < arr.length - 1; i++) {
      const diff = arr[i + 1] - arr[i];
      if (diff <= 0) return false;
      needed += diff - 1;
    }
    return needed <= numJokers;
  };

  if (canFormSequence(sorted, jokers.length)) {
    const span = sorted[sorted.length - 1] - sorted[0] + 1;
    if (span + (jokers.length - (span - sorted.length)) <= 14) return true;
  }

  // 12-13-1 Wrap around case: 1 follows 13
  if (sorted.includes(1) && sorted.some(n => n >= 11)) {
    const wrapped = sorted.map(n => (n === 1 ? 14 : n)).sort((a, b) => a - b);
    if (canFormSequence(wrapped, jokers.length)) return true;
  }

  return false;
};

// 3. Group Meld Validation (e.g. Red 7, Blue 7, Black 7)
export const isGroupMeld = (tiles: Tile[], okeyRef?: Tile | null): boolean => {
  if (tiles.length < 3 || tiles.length > 4) return false;

  const jokers = tiles.filter(t => t.isOkey);
  const regulars = tiles.filter(t => !t.isOkey);

  if (regulars.length === 0) return true;

  const num = regulars[0].number;
  if (regulars.some(t => t.number !== num)) return false;

  const colors = new Set<TileColor>();
  for (const t of regulars) {
    if (colors.has(t.color)) return false;
    colors.add(t.color);
  }

  return colors.size + jokers.length <= 4;
};

// 4. Pair Check (2 identical tiles or pair with Okey)
export const isPair = (t1: Tile, t2: Tile): boolean => {
  if (t1.isOkey || t2.isOkey) return true;
  return t1.number === t2.number && t1.color === t2.color;
};

// Check if 14 tiles can form 7 pairs
export const check7Pairs = (tiles: Tile[]): boolean => {
  if (tiles.length !== 14) return false;

  const used = new Array(14).fill(false);

  const matchPair = (idx: number): boolean => {
    if (idx >= 14) return true;
    if (used[idx]) return matchPair(idx + 1);

    used[idx] = true;
    for (let j = idx + 1; j < 14; j++) {
      if (!used[j] && isPair(tiles[idx], tiles[j])) {
        used[j] = true;
        if (matchPair(idx + 1)) return true;
        used[j] = false;
      }
    }
    used[idx] = false;
    return false;
  };

  return matchPair(0);
};

// Check if 14 tiles can be partitioned into valid runs/groups
export const checkValidRuns = (tiles: Tile[], okeyRef?: Tile | null): boolean => {
  if (tiles.length !== 14) return false;

  const n = tiles.length;
  const used = new Array(n).fill(false);

  const backtrack = (count: number): boolean => {
    if (count === n) return true;

    // Find first unused tile
    let firstUnused = -1;
    for (let i = 0; i < n; i++) {
      if (!used[i]) {
        firstUnused = i;
        break;
      }
    }
    if (firstUnused === -1) return true;

    // Remaining tiles
    const remainingIndices: number[] = [];
    for (let i = firstUnused + 1; i < n; i++) {
      if (!used[i]) remainingIndices.push(i);
    }

    // A meld can be size 3, 4, or 5
    // Try size 3 combinations
    for (let i = 0; i < remainingIndices.length; i++) {
      const idx1 = remainingIndices[i];
      for (let j = i + 1; j < remainingIndices.length; j++) {
        const idx2 = remainingIndices[j];
        const meld3 = [tiles[firstUnused], tiles[idx1], tiles[idx2]];
        if (isSerialMeld(meld3, okeyRef) || isGroupMeld(meld3, okeyRef)) {
          used[firstUnused] = true;
          used[idx1] = true;
          used[idx2] = true;
          if (backtrack(count + 3)) return true;
          used[firstUnused] = false;
          used[idx1] = false;
          used[idx2] = false;
        }

        // Try size 4 combinations
        for (let k = j + 1; k < remainingIndices.length; k++) {
          const idx3 = remainingIndices[k];
          const meld4 = [tiles[firstUnused], tiles[idx1], tiles[idx2], tiles[idx3]];
          if (isSerialMeld(meld4, okeyRef) || isGroupMeld(meld4, okeyRef)) {
            used[firstUnused] = true;
            used[idx1] = true;
            used[idx2] = true;
            used[idx3] = true;
            if (backtrack(count + 4)) return true;
            used[firstUnused] = false;
            used[idx1] = false;
            used[idx2] = false;
            used[idx3] = false;
          }

          // Try size 5 combinations
          for (let l = k + 1; l < remainingIndices.length; l++) {
            const idx4 = remainingIndices[l];
            const meld5 = [tiles[firstUnused], tiles[idx1], tiles[idx2], tiles[idx3], tiles[idx4]];
            if (isSerialMeld(meld5, okeyRef)) {
              used[firstUnused] = true;
              used[idx1] = true;
              used[idx2] = true;
              used[idx3] = true;
              used[idx4] = true;
              if (backtrack(count + 5)) return true;
              used[firstUnused] = false;
              used[idx1] = false;
              used[idx2] = false;
              used[idx3] = false;
              used[idx4] = false;
            }
          }
        }
      }
    }

    return false;
  };

  return backtrack(0);
};

// Comprehensive Classic Okey Winning Check
export const checkClassicOkeyWin = (
  hand: Tile[],
  okeyRef?: Tile | null,
  selectedDiscardId?: string
): { canWin: boolean; discardTileId?: string; isPairs?: boolean; reason?: string } => {
  if (hand.length < 14) {
    return { canWin: false, reason: 'Elinizde yeterli taş yok (en az 14 taş gerekir).' };
  }

  // If hand has 14 tiles exactly (e.g. discard already made)
  if (hand.length === 14) {
    if (check7Pairs(hand)) {
      return { canWin: true, isPairs: true, reason: '7 Çift ile bitti! 🏆' };
    }
    if (checkValidRuns(hand, okeyRef)) {
      return { canWin: true, isPairs: false, reason: 'Perler tamamlandı ve el bitti! 🏆' };
    }
    return { canWin: false, reason: 'Elinizdeki taşlar kurala uygun per veya 7 çift oluşturmuyor.' };
  }

  // Hand has 15 tiles (player turn to discard 1 tile and declare win)
  if (hand.length === 15) {
    // If a specific discard is chosen by the player, test that candidate first
    if (selectedDiscardId) {
      const filtered = hand.filter(t => t.id !== selectedDiscardId);
      if (filtered.length === 14) {
        if (check7Pairs(filtered)) {
          return { canWin: true, discardTileId: selectedDiscardId, isPairs: true, reason: '7 Çift ile bitti! 🏆' };
        }
        if (checkValidRuns(filtered, okeyRef)) {
          return { canWin: true, discardTileId: selectedDiscardId, isPairs: false, reason: 'Perler tamamlandı ve el bitti! 🏆' };
        }
      }
    }

    // Otherwise, check all 15 possible discards to see if any leaves a winning 14-tile hand
    for (const discardCandidate of hand) {
      const filtered = hand.filter(t => t.id !== discardCandidate.id);
      if (filtered.length === 14) {
        if (check7Pairs(filtered)) {
          return { canWin: true, discardTileId: discardCandidate.id, isPairs: true, reason: '7 Çift ile bitti! 🏆' };
        }
        if (checkValidRuns(filtered, okeyRef)) {
          return { canWin: true, discardTileId: discardCandidate.id, isPairs: false, reason: 'Perler tamamlandı ve el bitti! 🏆' };
        }
      }
    }

    return { canWin: false, reason: 'Eliniz henüz bitmeye uygun değil. 14 taş per veya 7 çift olmalı.' };
  }

  return { canWin: false, reason: 'Elinizde geçersiz sayıda taş bulunuyor.' };
};

// 5. Auto Sorting Helpers for Player Rack
export const autoSortRuns = (tiles: (Tile | null)[]): (Tile | null)[] => {
  const nonNull = tiles.filter((t): t is Tile => t !== null);
  const colorOrder: Record<TileColor, number> = { red: 1, blue: 2, black: 3, yellow: 4, fake: 5 };

  // Sort by color first, then number, jokers at the end
  nonNull.sort((a, b) => {
    if (a.isOkey && !b.isOkey) return 1;
    if (!a.isOkey && b.isOkey) return -1;
    if (colorOrder[a.color] !== colorOrder[b.color]) {
      return colorOrder[a.color] - colorOrder[b.color];
    }
    return a.number - b.number;
  });

  const newRack: (Tile | null)[] = Array(tiles.length).fill(null);
  nonNull.forEach((t, i) => {
    newRack[i] = t;
  });
  return newRack;
};

export const autoSortPairs = (tiles: (Tile | null)[]): (Tile | null)[] => {
  const nonNull = tiles.filter((t): t is Tile => t !== null);

  // Group tiles by number and color
  nonNull.sort((a, b) => {
    if (a.isOkey && !b.isOkey) return 1;
    if (!a.isOkey && b.isOkey) return -1;
    if (a.number !== b.number) {
      return a.number - b.number;
    }
    return a.color.localeCompare(b.color);
  });

  const newRack: (Tile | null)[] = Array(tiles.length).fill(null);
  nonNull.forEach((t, i) => {
    newRack[i] = t;
  });
  return newRack;
};
