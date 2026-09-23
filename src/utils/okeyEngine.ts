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

/**
 * Robustly analyze whether a collection of tiles forms a valid serial run in Classic Okey,
 * calculating the sequence and optimal visual tile order (seamlessly placing Okey wildcards).
 */
export interface BestRunAnalysisClassic {
  valid: boolean;
  score: number;
  type: 'standard' | 'wrap';
  sequence: number[];
  orderedTiles: Tile[];
}

export const analyzeBestRunSequenceClassic = (
  tiles: Tile[],
  okeyRef?: Tile | null
): BestRunAnalysisClassic => {
  if (!tiles || tiles.length < 3 || tiles.length > 13) {
    return { valid: false, score: 0, type: 'standard', sequence: [], orderedTiles: [...(tiles || [])] };
  }

  const regulars = tiles.filter(t => !isTileOkey(t, okeyRef));
  const jokers = tiles.filter(t => isTileOkey(t, okeyRef));

  if (regulars.length === 0) {
    return {
      valid: true,
      score: tiles.length * 10,
      type: 'standard',
      sequence: Array(tiles.length).fill(10),
      orderedTiles: [...tiles]
    };
  }

  const runColor = regulars[0].color;
  if (regulars.some(t => t.color !== runColor)) {
    return { valid: false, score: 0, type: 'standard', sequence: [], orderedTiles: [...tiles] };
  }

  // Ensure regular tiles have distinct numbers (cannot have duplicate numbers in a single run)
  const regNumSet = new Set<number>();
  for (const r of regulars) {
    if (regNumSet.has(r.number)) {
      return { valid: false, score: 0, type: 'standard', sequence: [], orderedTiles: [...tiles] };
    }
    regNumSet.add(r.number);
  }

  const L = tiles.length;
  const regNums = regulars.map(t => t.number);
  let bestCandidate: { score: number; type: 'standard' | 'wrap'; sequence: number[] } | null = null;

  // 1. Standard straight sequence: S .. S + L - 1 (S in 1 .. 13 - L + 1)
  for (let S = 1; S <= 13 - L + 1; S++) {
    const E = S + L - 1;
    if (regNums.every(n => n >= S && n <= E)) {
      const seq: number[] = [];
      let score = 0;
      for (let n = S; n <= E; n++) {
        seq.push(n);
        score += n;
      }
      if (!bestCandidate || score > bestCandidate.score) {
        bestCandidate = { score, type: 'standard', sequence: seq };
      }
    }
  }

  // 2. Wrapping sequence ending in 1 (e.g. 12-13-1, 11-12-13-1, 10-11-12-13-1)
  if (L >= 3 && L <= 5) {
    const wrapSeq: number[] = [];
    let wrapScore = 1;
    for (let pos = 15 - L; pos <= 13; pos++) {
      wrapSeq.push(pos);
      wrapScore += pos;
    }
    wrapSeq.push(1);

    if (regNums.every(n => wrapSeq.includes(n))) {
      if (!bestCandidate || wrapScore > bestCandidate.score) {
        bestCandidate = { score: wrapScore, type: 'wrap', sequence: wrapSeq };
      }
    }
  }

  if (!bestCandidate) {
    return { valid: false, score: 0, type: 'standard', sequence: [], orderedTiles: [...tiles] };
  }

  // Order tiles according to the best sequence
  const orderedTiles: Tile[] = [];
  const unusedRegs = [...regulars];
  const unusedJokers = [...jokers];

  for (const num of bestCandidate.sequence) {
    const idx = unusedRegs.findIndex(r => r.number === num);
    if (idx !== -1) {
      orderedTiles.push(unusedRegs.splice(idx, 1)[0]);
    } else if (unusedJokers.length > 0) {
      orderedTiles.push(unusedJokers.pop()!);
    }
  }

  if (orderedTiles.length !== L) {
    return { valid: false, score: 0, type: 'standard', sequence: [], orderedTiles: [...tiles] };
  }

  return {
    valid: true,
    score: bestCandidate.score,
    type: bestCandidate.type,
    sequence: bestCandidate.sequence,
    orderedTiles
  };
};

// Helper to order tiles sequentially within a serial run (including Okey in its exact numeric position)
export const orderSerialRun = (tiles: Tile[], okeyRef?: Tile | null): Tile[] => {
  const analysis = analyzeBestRunSequenceClassic(tiles, okeyRef);
  return analysis.valid ? analysis.orderedTiles : [...tiles];
};

// Helper to order tiles within a group meld
export const orderGroupMeld = (tiles: Tile[], okeyRef?: Tile | null): Tile[] => {
  const jokers = tiles.filter(t => isTileOkey(t, okeyRef));
  const regulars = tiles.filter(t => !isTileOkey(t, okeyRef));
  const colorOrder: Record<TileColor, number> = { red: 1, blue: 2, black: 3, yellow: 4, fake: 5 };
  regulars.sort((a, b) => (colorOrder[a.color] || 99) - (colorOrder[b.color] || 99));
  return [...regulars, ...jokers];
};

// Helper to intelligently organize unmelded tiles (pairs together, run-neighbors together, singles sorted)
export const organizeUnmeldedTiles = (unmelded: Tile[]): Tile[] => {
  if (unmelded.length <= 1) return [...unmelded];

  const pool = [...unmelded];
  const organized: Tile[] = [];

  // 1. Group identical pairs (same color & number)
  for (let i = 0; i < pool.length; i++) {
    const t1 = pool[i];
    if (!t1) continue;
    for (let j = i + 1; j < pool.length; j++) {
      const t2 = pool[j];
      if (!t2) continue;
      if (t1.color === t2.color && t1.number === t2.number) {
        organized.push(t1, t2);
        pool.splice(j, 1);
        pool.splice(i, 1);
        i--;
        break;
      }
    }
  }

  // 2. Group 2-tile run neighbors (same color, adjacent numbers or 1-gap)
  for (let i = 0; i < pool.length; i++) {
    const t1 = pool[i];
    if (!t1) continue;
    for (let j = i + 1; j < pool.length; j++) {
      const t2 = pool[j];
      if (!t2) continue;
      if (t1.color === t2.color && Math.abs(t1.number - t2.number) <= 2 && t1.number !== t2.number) {
        const pair = [t1, t2].sort((a, b) => a.number - b.number);
        organized.push(...pair);
        pool.splice(j, 1);
        pool.splice(i, 1);
        i--;
        break;
      }
    }
  }

  // 3. Group 2-tile number pairs (same number, different color)
  for (let i = 0; i < pool.length; i++) {
    const t1 = pool[i];
    if (!t1) continue;
    for (let j = i + 1; j < pool.length; j++) {
      const t2 = pool[j];
      if (!t2) continue;
      if (t1.number === t2.number && t1.color !== t2.color) {
        organized.push(t1, t2);
        pool.splice(j, 1);
        pool.splice(i, 1);
        i--;
        break;
      }
    }
  }

  // 4. Sort remaining isolated singles by color then number
  const colorOrder: Record<TileColor, number> = { red: 1, blue: 2, black: 3, yellow: 4, fake: 5 };
  pool.sort((a, b) => {
    if (colorOrder[a.color] !== colorOrder[b.color]) {
      return (colorOrder[a.color] || 99) - (colorOrder[b.color] || 99);
    }
    return a.number - b.number;
  });

  organized.push(...pool);
  return organized;
};

interface CandidateMeldClassic {
  tiles: Tile[];
  tileIds: string[];
  type: 'run' | 'group';
  length: number;
  score: number;
}

// Find optimal meld partition for Classic Okey (14-15 tiles), utilizing Okeys seamlessly
export const findOptimalMeldsClassic = (
  hand: Tile[],
  okeyRef?: Tile | null
): { melds: Tile[][]; unmelded: Tile[] } => {
  if (!hand || hand.length < 3) {
    return { melds: [], unmelded: organizeUnmeldedTiles(hand || []) };
  }

  const jokers = hand.filter(t => isTileOkey(t, okeyRef));
  const regulars = hand.filter(t => !isTileOkey(t, okeyRef));
  const candidateMelds: CandidateMeldClassic[] = [];

  // 1. Generate candidate runs for each color
  const colors: TileColor[] = ['red', 'blue', 'black', 'yellow'];
  for (const c of colors) {
    const colorTiles = regulars.filter(t => t.color === c);
    if (colorTiles.length + jokers.length < 3) continue;

    const byNumber = new Map<number, Tile[]>();
    for (const t of colorTiles) {
      if (!byNumber.has(t.number)) byNumber.set(t.number, []);
      byNumber.get(t.number)!.push(t);
    }

    // Straight runs S .. S + L - 1
    for (let S = 1; S <= 11; S++) {
      for (let L = 3; L <= Math.min(13 - S + 1, hand.length); L++) {
        let missing = 0;
        const usedRegs: Tile[] = [];

        for (let num = S; num < S + L; num++) {
          const matching = byNumber.get(num);
          if (matching && matching.length > 0) {
            usedRegs.push(matching[0]);
          } else {
            missing++;
          }
        }

        if (missing <= jokers.length) {
          const usedJokers = jokers.slice(0, missing);
          const allTiles = [...usedRegs, ...usedJokers];
          const analysis = analyzeBestRunSequenceClassic(allTiles, okeyRef);
          if (analysis.valid) {
            candidateMelds.push({
              tiles: analysis.orderedTiles,
              tileIds: analysis.orderedTiles.map(t => t.id),
              type: 'run',
              length: L,
              score: analysis.score
            });
          }
        }
      }
    }

    // Wrap runs: 12-13-1, 11-12-13-1, 10-11-12-13-1
    const wrapSequences = [
      [12, 13, 1],
      [11, 12, 13, 1],
      [10, 11, 12, 13, 1]
    ];
    for (const seq of wrapSequences) {
      if (seq.length > hand.length) continue;
      let missing = 0;
      const usedRegs: Tile[] = [];

      for (const num of seq) {
        const matching = byNumber.get(num);
        if (matching && matching.length > 0) {
          usedRegs.push(matching[0]);
        } else {
          missing++;
        }
      }

      if (missing <= jokers.length) {
        const usedJokers = jokers.slice(0, missing);
        const allTiles = [...usedRegs, ...usedJokers];
        const analysis = analyzeBestRunSequenceClassic(allTiles, okeyRef);
        if (analysis.valid) {
          candidateMelds.push({
            tiles: analysis.orderedTiles,
            tileIds: analysis.orderedTiles.map(t => t.id),
            type: 'run',
            length: seq.length,
            score: analysis.score
          });
        }
      }
    }
  }

  // 2. Generate candidate groups for each number (1..13)
  for (let num = 1; num <= 13; num++) {
    const numTiles = regulars.filter(t => t.number === num);
    const byColor = new Map<TileColor, Tile>();
    for (const t of numTiles) {
      if (!byColor.has(t.color)) byColor.set(t.color, t);
    }
    const uniqueRegs = Array.from(byColor.values());

    // Group of 3
    if (uniqueRegs.length + jokers.length >= 3) {
      for (let jCount = 0; jCount <= Math.min(jokers.length, 2); jCount++) {
        const needRegs = 3 - jCount;
        if (uniqueRegs.length >= needRegs) {
          // Generate combinations of needRegs
          const combinations = (arr: Tile[], k: number): Tile[][] => {
            if (k === 0) return [[]];
            if (arr.length < k) return [];
            const head = arr[0];
            const withHead = combinations(arr.slice(1), k - 1).map(c => [head, ...c]);
            const withoutHead = combinations(arr.slice(1), k);
            return [...withHead, ...withoutHead];
          };

          const regCombos = combinations(uniqueRegs, needRegs);
          const chosenJokers = jokers.slice(0, jCount);

          for (const rc of regCombos) {
            const allTiles = orderGroupMeld([...rc, ...chosenJokers], okeyRef);
            if (isGroupMeld(allTiles, okeyRef)) {
              candidateMelds.push({
                tiles: allTiles,
                tileIds: allTiles.map(t => t.id),
                type: 'group',
                length: 3,
                score: 3 * num
              });
            }
          }
        }
      }
    }

    // Group of 4
    if (uniqueRegs.length + jokers.length >= 4) {
      for (let jCount = 0; jCount <= Math.min(jokers.length, 3); jCount++) {
        const needRegs = 4 - jCount;
        if (uniqueRegs.length >= needRegs) {
          const combinations = (arr: Tile[], k: number): Tile[][] => {
            if (k === 0) return [[]];
            if (arr.length < k) return [];
            const head = arr[0];
            const withHead = combinations(arr.slice(1), k - 1).map(c => [head, ...c]);
            const withoutHead = combinations(arr.slice(1), k);
            return [...withHead, ...withoutHead];
          };

          const regCombos = combinations(uniqueRegs, needRegs);
          const chosenJokers = jokers.slice(0, jCount);

          for (const rc of regCombos) {
            const allTiles = orderGroupMeld([...rc, ...chosenJokers], okeyRef);
            if (isGroupMeld(allTiles, okeyRef)) {
              candidateMelds.push({
                tiles: allTiles,
                tileIds: allTiles.map(t => t.id),
                type: 'group',
                length: 4,
                score: 4 * num
              });
            }
          }
        }
      }
    }
  }

  // Remove exact duplicates in candidates, keeping highest score
  const candidateMap = new Map<string, CandidateMeldClassic>();
  for (const m of candidateMelds) {
    const key = [...m.tileIds].sort().join(',');
    const existing = candidateMap.get(key);
    if (!existing || m.score > existing.score) {
      candidateMap.set(key, m);
    }
  }
  const uniqueCandidates = Array.from(candidateMap.values());

  // Sort candidate melds: longer melds first, higher score first, runs slightly preferred
  uniqueCandidates.sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    if (b.score !== a.score) return b.score - a.score;
    if (a.type !== b.type) return a.type === 'run' ? -1 : 1;
    return 0;
  });

  // 3. Search for optimal disjoint melds combination (Branch and Bound)
  let bestMelds: CandidateMeldClassic[] = [];
  let bestValue = -1;

  const backtrack = (idx: number, usedTileIds: Set<string>, currentMelds: CandidateMeldClassic[], currentTiles: number, currentScore: number) => {
    // Upper bound calculation for pruning
    let remainingPotential = 0;
    for (let i = idx; i < uniqueCandidates.length; i++) {
      const cand = uniqueCandidates[i];
      let canUse = true;
      for (const tid of cand.tileIds) {
        if (usedTileIds.has(tid)) {
          canUse = false;
          break;
        }
      }
      if (canUse) remainingPotential += cand.length;
    }

    if (currentTiles + remainingPotential < Math.floor(bestValue / 10000)) {
      return;
    }

    // Score calculation
    const value = currentTiles * 10000 + currentScore * 10 + currentMelds.length * 5;
    if (value > bestValue) {
      bestValue = value;
      bestMelds = [...currentMelds];
    }

    if (currentTiles >= 14) return; // Maximum possible melded tiles for classic okey

    for (let i = idx; i < uniqueCandidates.length; i++) {
      const cand = uniqueCandidates[i];
      let disjoint = true;
      for (const tid of cand.tileIds) {
        if (usedTileIds.has(tid)) {
          disjoint = false;
          break;
        }
      }

      if (disjoint) {
        for (const tid of cand.tileIds) usedTileIds.add(tid);
        currentMelds.push(cand);

        backtrack(i + 1, usedTileIds, currentMelds, currentTiles + cand.length, currentScore + cand.score);

        currentMelds.pop();
        for (const tid of cand.tileIds) usedTileIds.delete(tid);
      }
    }
  };

  backtrack(0, new Set(), [], 0, 0);

  const usedIds = new Set<string>();
  const finalMelds: Tile[][] = [];
  for (const m of bestMelds) {
    finalMelds.push(m.tiles);
    for (const tid of m.tileIds) usedIds.add(tid);
  }

  const rawUnmelded = hand.filter(t => !usedIds.has(t.id));
  const organizedUnmelded = organizeUnmeldedTiles(rawUnmelded);

  return {
    melds: finalMelds,
    unmelded: organizedUnmelded
  };
};

// 5. Intelligent Auto Sorting Helpers for Player Rack (Classic Okey)
export const autoSortRuns = (tiles: (Tile | null)[], okeyRef?: Tile | null): (Tile | null)[] => {
  const nonNull = tiles.filter((t): t is Tile => t !== null);
  if (nonNull.length === 0) return [...tiles];

  const { melds, unmelded } = findOptimalMeldsClassic(nonNull, okeyRef);
  const newRack: (Tile | null)[] = Array(tiles.length).fill(null);
  const RACK_SIZE = tiles.length;
  const ROW_LEN = 15; // 2 rows of 15

  let currentSlot = 0;

  // Place melds with visual gaps, respecting 2-row layout cleanly
  for (const meld of melds) {
    // If we're on row 0 and meld doesn't fit on row 0, wrap to row 1 (slot 15)
    if (currentSlot < ROW_LEN && currentSlot + meld.length > ROW_LEN) {
      currentSlot = ROW_LEN;
    }

    if (currentSlot + meld.length > RACK_SIZE) break;

    for (const t of meld) {
      newRack[currentSlot++] = t;
    }

    // Leave 1 empty slot gap if space remains and not at row boundary
    if (currentSlot < RACK_SIZE && currentSlot !== ROW_LEN) {
      currentSlot++;
    }
  }

  // Place unmelded tiles (pairs, connectors, singles)
  for (const t of unmelded) {
    if (currentSlot < RACK_SIZE) {
      newRack[currentSlot++] = t;
    } else {
      // Find any remaining empty slot
      const emptyIdx = newRack.findIndex(s => s === null);
      if (emptyIdx !== -1) newRack[emptyIdx] = t;
    }
  }

  // Failsafe: ensure no tile from hand is missing
  const placedIds = new Set(newRack.filter((t): t is Tile => t !== null).map(t => t.id));
  for (const t of nonNull) {
    if (!placedIds.has(t.id)) {
      const freeIdx = newRack.findIndex(s => s === null);
      if (freeIdx !== -1) {
        newRack[freeIdx] = t;
        placedIds.add(t.id);
      }
    }
  }

  return newRack;
};

export const autoSortPairs = (tiles: (Tile | null)[], okeyRef?: Tile | null): (Tile | null)[] => {
  const nonNull = tiles.filter((t): t is Tile => t !== null);
  if (nonNull.length === 0) return [...tiles];

  const jokers = nonNull.filter(t => isTileOkey(t, okeyRef));
  const regulars = nonNull.filter(t => !isTileOkey(t, okeyRef));

  const pairs: Tile[][] = [];
  const unusedRegs = [...regulars];
  const unusedJokers = [...jokers];

  // 1. Exact identical pairs (same color and number)
  for (let i = 0; i < unusedRegs.length; i++) {
    const t1 = unusedRegs[i];
    if (!t1) continue;
    for (let j = i + 1; j < unusedRegs.length; j++) {
      const t2 = unusedRegs[j];
      if (!t2) continue;
      if (t1.color === t2.color && t1.number === t2.number) {
        pairs.push([t1, t2]);
        unusedRegs.splice(j, 1);
        unusedRegs.splice(i, 1);
        i--;
        break;
      }
    }
  }

  // 2. Use Jokers (Okeys) to pair with high unmatched tiles
  unusedRegs.sort((a, b) => b.number - a.number);
  while (unusedJokers.length > 0 && unusedRegs.length > 0) {
    const joker = unusedJokers.pop()!;
    const reg = unusedRegs.shift()!;
    pairs.push([reg, joker]);
  }

  // Two remaining jokers pair with each other
  while (unusedJokers.length >= 2) {
    pairs.push([unusedJokers.pop()!, unusedJokers.pop()!]);
  }

  // Remaining single tiles sorted
  const singles = [...unusedRegs, ...unusedJokers];
  const colorOrder: Record<TileColor, number> = { red: 1, blue: 2, black: 3, yellow: 4, fake: 5 };
  singles.sort((a, b) => {
    if (a.number !== b.number) return a.number - b.number;
    return (colorOrder[a.color] || 99) - (colorOrder[b.color] || 99);
  });

  const newRack: (Tile | null)[] = Array(tiles.length).fill(null);
  const RACK_SIZE = tiles.length;
  let slot = 0;

  for (const pair of pairs) {
    if (slot + 2 > RACK_SIZE) break;
    newRack[slot++] = pair[0];
    newRack[slot++] = pair[1];
    if (slot < RACK_SIZE) slot++; // Gap between pairs
  }

  for (const t of singles) {
    if (slot < RACK_SIZE) {
      newRack[slot++] = t;
    } else {
      const emptyIdx = newRack.findIndex(s => s === null);
      if (emptyIdx !== -1) newRack[emptyIdx] = t;
    }
  }

  // Failsafe: guarantee all tiles are placed
  const placedIds = new Set(newRack.filter((t): t is Tile => t !== null).map(t => t.id));
  for (const t of nonNull) {
    if (!placedIds.has(t.id)) {
      const freeIdx = newRack.findIndex(s => s === null);
      if (freeIdx !== -1) {
        newRack[freeIdx] = t;
        placedIds.add(t.id);
      }
    }
  }

  return newRack;
};
