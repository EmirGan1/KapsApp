export type TileColor = 'red' | 'blue' | 'black' | 'yellow' | 'fake';

export interface Tile {
  id: string;
  number: number; // 1-13, 0 for fake okey
  color: TileColor;
  isOkey?: boolean;
  isFake?: boolean;
}

export interface TableMeld {
  id: string;
  playerId: number;
  playerName: string;
  type: 'serial' | 'group' | 'pair';
  tiles: Tile[];
}

export interface OkeyPlayer {
  id: number;
  username: string;
  avatar?: string | null;
  color?: string | null;
  isBot?: boolean;
  tileCount: number;
  hasOpened: boolean;
  hasOpenedPairs: boolean;
  openedSum: number;
  discardPile: Tile[];
  score: number;
}

export interface OkeyRoomState {
  id: string;
  name: string;
  gameMode: 'classic' | '101';
  status: 'waiting' | 'playing' | 'ended';
  creatorId: number;
  players: OkeyPlayer[];
  deckCount: number;
  indicator: Tile | null;
  okeyTile: Tile | null;
  currentTurn: number;
  turnPhase: 'draw' | 'discard';
  centerMelds: TableMeld[];
  winnerId: number | null;
  winningReason: string | null;
  lastActionMessage?: string;
}

// 1. Deck & Okey Generator
export const generateDeck = (): { deck: Tile[]; indicator: Tile; okeyTile: Tile } => {
  const colors: TileColor[] = ['red', 'blue', 'black', 'yellow'];
  const allTiles: Tile[] = [];
  let idCount = 1;

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

  // Mark the real okeys and fake okeys in the deck
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

  // Separate regular tiles and jokers
  const jokers = tiles.filter(t => t.isOkey);
  const regulars = tiles.filter(t => !t.isOkey);

  if (regulars.length === 0) return true; // All jokers

  // Regular tiles must all be the same color
  const color = regulars[0].color;
  if (regulars.some(t => t.color !== color)) return false;

  // Numbers without jokers
  const nums = regulars.map(t => t.number);
  const uniqueNums = new Set(nums);
  if (uniqueNums.size !== nums.length) return false; // duplicate numbers not allowed in run

  // Check normal sequence (accounting for jokers as wildcards)
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

  // Normal run check
  if (canFormSequence(sorted, jokers.length)) {
    // Check range does not exceed 13
    const span = sorted[sorted.length - 1] - sorted[0] + 1;
    if (span + (jokers.length - (span - sorted.length)) <= 14) return true;
  }

  // 12-13-1 Wrap around case: 1 can follow 13
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
    if (colors.has(t.color)) return false; // same color twice not allowed in group
    colors.add(t.color);
  }

  return colors.size + jokers.length <= 4;
};

// 4. Pair Validation (e.g. 2 identical tiles)
export const isPair = (tiles: Tile[]): boolean => {
  if (tiles.length !== 2) return false;
  if (tiles[0].isOkey || tiles[1].isOkey) return true;
  return tiles[0].number === tiles[1].number && tiles[0].color === tiles[1].color;
};

// 5. Meld Score Calculation
export const calculateMeldSum = (tiles: Tile[], okeyRef?: Tile | null): number => {
  return tiles.reduce((sum, t) => {
    if (t.isOkey && okeyRef) {
      return sum + (okeyRef.number === 1 ? 11 : okeyRef.number);
    }
    return sum + (t.number === 1 ? 11 : t.number);
  }, 0);
};

// 6. 101 Mode Hand Open Check
export const check101Open = (
  melds: Tile[][],
  okeyRef?: Tile | null
): { valid: boolean; sum: number; isPairOpener: boolean; error?: string } => {
  if (melds.length === 0) {
    return { valid: false, sum: 0, isPairOpener: false, error: 'Hiç per seçilmedi.' };
  }

  let allPairs = true;
  let allSets = true;
  let totalSum = 0;

  for (const meld of melds) {
    if (isPair(meld)) {
      allSets = false;
      const val = meld[0].isOkey ? 10 : meld[0].number;
      totalSum += val * 2;
    } else if (isSerialMeld(meld, okeyRef) || isGroupMeld(meld, okeyRef)) {
      allPairs = false;
      totalSum += calculateMeldSum(meld, okeyRef);
    } else {
      return { valid: false, sum: 0, isPairOpener: false, error: 'Seçilen perlerden biri kurala uymuyor.' };
    }
  }

  if (allPairs) {
    if (melds.length >= 5) {
      return { valid: true, sum: totalSum, isPairOpener: true };
    }
    return {
      valid: false,
      sum: totalSum,
      isPairOpener: true,
      error: `Çiftten açmak için en az 5 çift gerekir (${melds.length}/5 çift var).`,
    };
  }

  if (allSets) {
    if (totalSum >= 101) {
      return { valid: true, sum: totalSum, isPairOpener: false };
    }
    return {
      valid: false,
      sum: totalSum,
      isPairOpener: false,
      error: `Perlerin sayı toplamı en az 101 olmalıdır (Şu anki toplam: ${totalSum}).`,
    };
  }

  return { valid: false, sum: totalSum, isPairOpener: false, error: 'Aynı anda hem per hem çift açılamaz.' };
};

// 7. Check if a single tile can be added to an opened meld (Taş İşleme)
export const canAddToMeld = (tile: Tile, meld: TableMeld, okeyRef?: Tile | null): boolean => {
  if (meld.type === 'pair') return false; // cannot add to pairs

  // Try prepend or append
  const testBefore = [tile, ...meld.tiles];
  const testAfter = [...meld.tiles, tile];

  if (meld.type === 'serial') {
    return isSerialMeld(testBefore, okeyRef) || isSerialMeld(testAfter, okeyRef);
  } else if (meld.type === 'group') {
    return isGroupMeld(testAfter, okeyRef);
  }

  return false;
};

// 8. Auto Sorting Helpers for Player Rack
export const autoSortRuns = (tiles: (Tile | null)[]): (Tile | null)[] => {
  const nonNull = tiles.filter((t): t is Tile => t !== null);
  // Sort by color first, then number
  const colorOrder: Record<TileColor, number> = { red: 1, blue: 2, black: 3, yellow: 4, fake: 5 };

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

  // Group tiles by number
  nonNull.sort((a, b) => {
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
