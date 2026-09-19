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
  hostId: number;
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

// Helper to determine if a tile is a Real Okey (Joker / Wildcard)
export const isTileOkey = (tile: Tile, okeyRef?: Tile | null): boolean => {
  if (!tile) return false;
  // Fake Okey is NEVER a joker - it represents the face value of the replaced tile
  if (tile.isFake) return false;
  if (tile.isOkey) return true;
  if (okeyRef && tile.color === okeyRef.color && tile.number === okeyRef.number) {
    return true;
  }
  return false;
};

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
  allTiles.push({ id: `t_${idCount++}`, number: 0, color: 'fake', isFake: true, isOkey: false });
  allTiles.push({ id: `t_${idCount++}`, number: 0, color: 'fake', isFake: true, isOkey: false });

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
      // Fake okey takes the place of the real okey's face value as a standard tile
      t.number = okeyTile.number;
      t.color = okeyTile.color;
      t.isOkey = false;
    } else if (t.color === okeyTile.color && t.number === okeyTile.number) {
      t.isOkey = true;
    }
  }

  return { deck: allTiles, indicator, okeyTile };
};

// 2. Serial Meld Validation (e.g. Red 4-5-6 or 9-[Okey]-11-12 or 12-13-1)
export const isSerialMeld = (tiles: Tile[], okeyRef?: Tile | null): boolean => {
  if (tiles.length < 3 || tiles.length > 13) return false;

  const jokers = tiles.filter(t => isTileOkey(t, okeyRef));
  const regulars = tiles.filter(t => !isTileOkey(t, okeyRef));

  if (regulars.length === 0) return true; // All jokers

  // Regular tiles must all be same color
  const color = regulars[0].color;
  if (regulars.some(t => t.color !== color)) return false;

  const regNums = regulars.map(t => t.number);
  const uniqueNums = new Set(regNums);
  if (uniqueNums.size !== regNums.length) return false; // Duplicate numbers not allowed in single run

  const L = tiles.length;

  // 1. Check standard straight runs (1..13)
  for (let S = 1; S <= 13 - L + 1; S++) {
    const E = S + L - 1;
    if (regNums.every(n => n >= S && n <= E)) {
      return true;
    }
  }

  // 2. Check 13-1 wrap around (e.g., 12-13-1, 11-12-13-1, 10-11-12-13-1)
  // In Okey rules, 1 can follow 13, but run cannot wrap further (e.g., 13-1-2 is not valid)
  const wrappedNums = regNums.map(n => (n === 1 ? 14 : n));
  const uniqueWrapped = new Set(wrappedNums);
  if (uniqueWrapped.size === wrappedNums.length) {
    const S = 14 - L + 1;
    if (S >= 1 && wrappedNums.every(n => n >= S && n <= 14)) {
      return true;
    }
  }

  return false;
};

// 3. Group Meld Validation (e.g. Red 7, Blue 7, Black 7 or Red 7, Blue 7, [Okey])
export const isGroupMeld = (tiles: Tile[], okeyRef?: Tile | null): boolean => {
  if (tiles.length < 3 || tiles.length > 4) return false;

  const jokers = tiles.filter(t => isTileOkey(t, okeyRef));
  const regulars = tiles.filter(t => !isTileOkey(t, okeyRef));

  if (regulars.length === 0) return true; // All jokers

  const targetNumber = regulars[0].number;
  if (regulars.some(t => t.number !== targetNumber)) return false;

  const colors = new Set<TileColor>();
  for (const t of regulars) {
    if (colors.has(t.color)) return false; // Duplicate colors not allowed in same group
    colors.add(t.color);
  }

  // Total distinct colors + jokers must be <= 4 (only 4 colors exist)
  return colors.size + jokers.length <= 4;
};

// 4. Pair Check (2 identical tiles or regular + Okey or 2 Okeys)
export const isPair = (t1: Tile, t2: Tile, okeyRef?: Tile | null): boolean => {
  if (isTileOkey(t1, okeyRef) || isTileOkey(t2, okeyRef)) return true;
  return t1.number === t2.number && t1.color === t2.color;
};

// Check if 14 tiles can form 7 pairs
export const check7Pairs = (tiles: Tile[], okeyRef?: Tile | null): boolean => {
  if (tiles.length !== 14) return false;

  const jokers = tiles.filter(t => isTileOkey(t, okeyRef));
  const regulars = tiles.filter(t => !isTileOkey(t, okeyRef));

  // Count identical regular tiles (color + number)
  const counts = new Map<string, number>();
  for (const t of regulars) {
    const key = `${t.color}_${t.number}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  let pairsFromIdentical = 0;
  let unpairedSingles = 0;

  for (const count of counts.values()) {
    pairsFromIdentical += Math.floor(count / 2);
    unpairedSingles += count % 2;
  }

  let availableJokers = jokers.length;
  if (availableJokers < unpairedSingles) {
    return false;
  }

  const pairsWithJokers = unpairedSingles;
  const remainingJokers = availableJokers - unpairedSingles;
  const pairsFromJokerPairs = Math.floor(remainingJokers / 2);

  const totalPairs = pairsFromIdentical + pairsWithJokers + pairsFromJokerPairs;
  return totalPairs === 7;
};

// Helper to find all valid candidate melds containing the root tile
const getValidMeldsForTile = (
  rootIdx: number,
  availableIndices: number[],
  tiles: Tile[],
  okeyRef?: Tile | null,
  maxLen: number = 14
): number[][] => {
  const rootTile = tiles[rootIdx];
  const rootIsOkey = isTileOkey(rootTile, okeyRef);
  const result: number[][] = [];

  // Group candidate pool (same number or jokers)
  const groupCandidates = availableIndices.filter(idx => {
    const t = tiles[idx];
    if (isTileOkey(t, okeyRef)) return true;
    if (rootIsOkey) return true;
    return t.number === rootTile.number;
  });

  // Size 3 group combinations
  if (groupCandidates.length >= 2) {
    for (let i = 0; i < groupCandidates.length; i++) {
      for (let j = i + 1; j < groupCandidates.length; j++) {
        const c = [rootIdx, groupCandidates[i], groupCandidates[j]];
        if (isGroupMeld(c.map(k => tiles[k]), okeyRef)) {
          result.push(c);
        }
      }
    }
  }

  // Size 4 group combinations
  if (groupCandidates.length >= 3 && maxLen >= 4) {
    for (let i = 0; i < groupCandidates.length; i++) {
      for (let j = i + 1; j < groupCandidates.length; j++) {
        for (let k = j + 1; k < groupCandidates.length; k++) {
          const c = [rootIdx, groupCandidates[i], groupCandidates[j], groupCandidates[k]];
          if (isGroupMeld(c.map(m => tiles[m]), okeyRef)) {
            result.push(c);
          }
        }
      }
    }
  }

  // Serial candidate pool (same color or jokers)
  const colorsToCheck: TileColor[] = rootIsOkey ? ['red', 'blue', 'black', 'yellow'] : [rootTile.color];
  for (const col of colorsToCheck) {
    const serialCandidates = availableIndices.filter(idx => {
      const t = tiles[idx];
      if (isTileOkey(t, okeyRef)) return true;
      return t.color === col;
    });

    if (serialCandidates.length < 2) continue;

    const generateSerialSubsets = (start: number, current: number[], targetSize: number) => {
      if (current.length === targetSize) {
        if (isSerialMeld(current.map(k => tiles[k]), okeyRef)) {
          result.push([...current]);
        }
        return;
      }
      for (let i = start; i < serialCandidates.length; i++) {
        current.push(serialCandidates[i]);
        generateSerialSubsets(i + 1, current, targetSize);
        current.pop();
      }
    };

    const maxSearchLen = Math.min(maxLen, serialCandidates.length + 1, 13);
    for (let size = 3; size <= maxSearchLen; size++) {
      generateSerialSubsets(0, [rootIdx], size);
    }
  }

  return result;
};

// Check if 14 tiles can be partitioned into valid runs/groups (3+3+4+4, 3+3+3+5, 4+5+5, etc.)
export const checkValidRuns = (tiles: Tile[], okeyRef?: Tile | null): boolean => {
  if (tiles.length !== 14) return false;

  const n = 14;
  const used = new Array(n).fill(false);

  // Canonical sort for stable search: by color, then number, jokers last
  const sortedTiles = [...tiles].sort((a, b) => {
    const okeyA = isTileOkey(a, okeyRef);
    const okeyB = isTileOkey(b, okeyRef);
    if (okeyA && !okeyB) return 1;
    if (!okeyA && okeyB) return -1;
    if (a.color !== b.color) return a.color.localeCompare(b.color);
    return a.number - b.number;
  });

  const backtrack = (remainingCount: number): boolean => {
    if (remainingCount === 0) return true;

    // Find first unused tile
    let firstUnused = -1;
    for (let i = 0; i < n; i++) {
      if (!used[i]) {
        firstUnused = i;
        break;
      }
    }
    if (firstUnused === -1) return true;

    // Pool of other unused tile indices
    const otherUnused: number[] = [];
    for (let i = firstUnused + 1; i < n; i++) {
      if (!used[i]) otherUnused.push(i);
    }

    const candidateMelds = getValidMeldsForTile(firstUnused, otherUnused, sortedTiles, okeyRef, remainingCount);

    for (const meld of candidateMelds) {
      for (const idx of meld) used[idx] = true;
      if (backtrack(remainingCount - meld.length)) {
        return true;
      }
      for (const idx of meld) used[idx] = false;
    }

    return false;
  };

  return backtrack(14);
};

// Comprehensive Classic Okey Winning Check
// Handles 14 tiles & 15 tiles (auto-detects the 15th discard/finish tile)
export const checkClassicOkeyWin = (
  hand: Tile[],
  okeyRef?: Tile | null,
  selectedDiscardId?: string
): { canWin: boolean; discardTileId?: string; isPairs?: boolean; reason?: string } => {
  if (!hand || hand.length < 14) {
    return { canWin: false, reason: 'Elinizde yeterli taş yok (en az 14 taş gerekir).' };
  }

  // 14 tiles exactly
  if (hand.length === 14) {
    if (check7Pairs(hand, okeyRef)) {
      return { canWin: true, isPairs: true, reason: '7 Çift ile bitti! 🏆' };
    }
    if (checkValidRuns(hand, okeyRef)) {
      return { canWin: true, isPairs: false, reason: 'Perler tamamlandı ve el bitti! 🏆' };
    }
    return { canWin: false, reason: 'Elinizdeki taşlar kurala uygun per veya 7 çift oluşturmuyor.' };
  }

  // 15 tiles (Player has drawn or started with 15 tiles, needs to discard 1 tile to finish)
  if (hand.length === 15) {
    // 1. If user selected a specific tile to discard, test it FIRST
    if (selectedDiscardId) {
      const selectedIndex = hand.findIndex(t => t.id === selectedDiscardId);
      if (selectedIndex !== -1) {
        const candidateDiscard = hand[selectedIndex];
        const remaining14 = hand.filter((_, idx) => idx !== selectedIndex);
        if (check7Pairs(remaining14, okeyRef)) {
          return { canWin: true, discardTileId: candidateDiscard.id, isPairs: true, reason: '7 Çift ile bitti! 🏆' };
        }
        if (checkValidRuns(remaining14, okeyRef)) {
          return { canWin: true, discardTileId: candidateDiscard.id, isPairs: false, reason: 'Perler tamamlandı ve el bitti! 🏆' };
        }
      }
    }

    // 2. Automatically test each of the 15 tiles as the extra / discard tile
    for (let i = 0; i < hand.length; i++) {
      const candidateDiscard = hand[i];
      if (selectedDiscardId && candidateDiscard.id === selectedDiscardId) continue;

      const remaining14 = hand.filter((_, idx) => idx !== i);
      if (check7Pairs(remaining14, okeyRef)) {
        return { canWin: true, discardTileId: candidateDiscard.id, isPairs: true, reason: '7 Çift ile bitti! 🏆' };
      }
      if (checkValidRuns(remaining14, okeyRef)) {
        return { canWin: true, discardTileId: candidateDiscard.id, isPairs: false, reason: 'Perler tamamlandı ve el bitti! 🏆' };
      }
    }

    return { canWin: false, reason: 'Eliniz henüz bitmeye uygun değil. 14 taş per veya 7 çift olmalıdır.' };
  }

  return { canWin: false, reason: 'Elinizde geçersiz sayıda taş bulunuyor.' };
};

// 5. Auto Sorting Helpers for Player Rack
export const autoSortRuns = (tiles: (Tile | null)[], okeyRef?: Tile | null): (Tile | null)[] => {
  const nonNull = tiles.filter((t): t is Tile => t !== null);
  const colorOrder: Record<TileColor, number> = { red: 1, blue: 2, black: 3, yellow: 4, fake: 5 };

  nonNull.sort((a, b) => {
    const okeyA = isTileOkey(a, okeyRef);
    const okeyB = isTileOkey(b, okeyRef);
    if (okeyA && !okeyB) return 1;
    if (!okeyA && okeyB) return -1;
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

export const autoSortPairs = (tiles: (Tile | null)[], okeyRef?: Tile | null): (Tile | null)[] => {
  const nonNull = tiles.filter((t): t is Tile => t !== null);

  nonNull.sort((a, b) => {
    const okeyA = isTileOkey(a, okeyRef);
    const okeyB = isTileOkey(b, okeyRef);
    if (okeyA && !okeyB) return 1;
    if (!okeyA && okeyB) return -1;
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
