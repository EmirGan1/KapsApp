/**
 * 101 Okey Game Engine (Okey101Engine)
 * Full implementation of international & Turkish 101 Okey rules:
 * - 106 Tiles (Red, Blue, Black, Yellow 1-13 x2 + 2 Fake Okeys)
 * - 22 tiles to dealer, 21 tiles to other 3 players
 * - Serial Runs & Groups validation
 * - 101 threshold & Katlamalı (Folding) mode logic
 * - 5+ Pairs (Çift) opening
 * - Processing / Appending tiles onto opened melds on the table
 * - İşler taş atma penalty (+101) & round scoring (202 / 404 / hand sum / x2 Okey finish)
 */

export type TileColor = 'red' | 'blue' | 'black' | 'yellow' | 'fake';

export interface Tile101 {
  id: string;
  number: number; // 1-13 (0 for fake okey initially)
  color: TileColor;
  isOkey?: boolean;
  isFake?: boolean;
}

export type MeldType = 'run' | 'group' | 'pair';

export interface Okey101Meld {
  id: string;
  playerId: number;
  playerUsername: string;
  type: MeldType;
  tiles: Tile101[];
  score: number;
}

export interface Okey101Player {
  id: number;
  username: string;
  avatar?: string | null;
  color?: string | null;
  isBot?: boolean;
  socketId?: string;
  hand: Tile101[];
  tileCount?: number;
  discardPile: Tile101[];
  hasOpened: boolean;
  openedMode?: 'serial' | 'double';
  openedMeldsCount: number;
  openedScore: number;
  penalties: number; // Cumulative penalty points across rounds (lower is better in 101)
  roundPenalty: number;
}

export interface Okey101RoomState {
  id: string;
  name: string;
  gameMode: 'okey101';
  subMode: 'katlamali' | 'duz';
  status: 'waiting' | 'playing' | 'ended';
  hostId: number;
  creatorId: number;
  players: Okey101Player[];
  deckCount: number;
  indicator: Tile101 | null;
  okeyTile: Tile101 | null;
  currentTurn: number;
  turnPhase: 'draw' | 'discard';
  highestOpenScore: number; // In katlamalı, next opener must exceed this
  highestPairsCount?: number; // In katlamalı, next pair opener must exceed this
  openedMelds: Okey101Meld[];
  turnTimeRemaining: number;
  roundNumber: number;
  winnerId: number | null;
  winningReason: string | null;
  lastActionMessage?: string;
}

/**
 * Check if a tile is the Real Okey (Wildcard)
 */
export const isTileOkey = (tile: Tile101, okeyRef?: Tile101 | null): boolean => {
  if (!tile) return false;
  if (tile.isFake) return false;
  if (tile.isOkey) return true;
  if (okeyRef && tile.color === okeyRef.color && tile.number === okeyRef.number) {
    return true;
  }
  return false;
};

/**
 * Generate and shuffle standard 106-tile deck, determine indicator & Okey
 */
export const generate101Deck = (): { deck: Tile101[]; indicator: Tile101; okeyTile: Tile101 } => {
  const colors: TileColor[] = ['red', 'blue', 'black', 'yellow'];
  const allTiles: Tile101[] = [];
  let idCount = 1;

  for (const color of colors) {
    for (let num = 1; num <= 13; num++) {
      allTiles.push({ id: `t101_${idCount++}`, number: num, color });
      allTiles.push({ id: `t101_${idCount++}`, number: num, color });
    }
  }

  // 2 Fake Okeys
  allTiles.push({ id: `t101_${idCount++}`, number: 0, color: 'fake', isFake: true, isOkey: false });
  allTiles.push({ id: `t101_${idCount++}`, number: 0, color: 'fake', isFake: true, isOkey: false });

  // Shuffle
  for (let i = allTiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allTiles[i], allTiles[j]] = [allTiles[j], allTiles[i]];
  }

  // Pick indicator
  let indicatorIdx = allTiles.findIndex((t) => !t.isFake);
  if (indicatorIdx === -1) indicatorIdx = 0;
  const indicator = allTiles.splice(indicatorIdx, 1)[0];

  // Okey is next number of indicator color
  const okeyNumber = indicator.number === 13 ? 1 : indicator.number + 1;
  const okeyTile: Tile101 = {
    id: 'okey_ref',
    number: okeyNumber,
    color: indicator.color,
    isOkey: true,
  };

  // Re-map fake okeys and mark real okeys
  for (const t of allTiles) {
    if (t.isFake) {
      t.number = okeyTile.number;
      t.color = okeyTile.color;
      t.isOkey = false;
    } else if (t.color === okeyTile.color && t.number === okeyTile.number) {
      t.isOkey = true;
    }
  }

  return { deck: allTiles, indicator, okeyTile };
};

/**
 * Deal tiles for 101 Okey:
 * Dealer gets 22 tiles, other players get 21 tiles each.
 */
export const deal101Hands = (
  deck: Tile101[],
  dealerIndex: number = 0,
  playerCount: number = 4
): { hands: Tile101[][]; remainingDeck: Tile101[] } => {
  const count = Math.max(2, Math.min(4, playerCount || 4));
  const hands: Tile101[][] = Array.from({ length: count }, () => []);
  const cloneDeck = [...deck];

  for (let p = 0; p < count; p++) {
    const tileCount = p === dealerIndex ? 22 : 21;
    hands[p] = cloneDeck.splice(0, tileCount);
  }

  return { hands, remainingDeck: cloneDeck };
};

/**
 * Validate a consecutive Run (Seri Per)
 * Same color, consecutive numbers, at least 3 tiles.
 * 12-13-1 is valid. (1 after 13 is allowed).
 */
export const isValidRun = (tiles: Tile101[], okeyRef?: Tile101 | null): { valid: boolean; score: number } => {
  if (!tiles || tiles.length < 3 || tiles.length > 13) return { valid: false, score: 0 };

  const regulars = tiles.filter((t) => !isTileOkey(t, okeyRef));
  const okeysCount = tiles.length - regulars.length;

  if (regulars.length === 0) {
    // All okeys (rare/theoretical)
    return { valid: true, score: tiles.length * 10 };
  }

  const runColor = regulars[0].color;
  if (regulars.some((t) => t.color !== runColor)) {
    return { valid: false, score: 0 };
  }

  // Check if standard sequence or 12-13-1 wrapping sequence
  // Normal consecutive without wrap
  const canBeStandard = checkStandardSequence(tiles, okeyRef);
  if (canBeStandard.valid) {
    return canBeStandard;
  }

  // Check wrap sequence (ends with 13-1 or 12-13-1)
  const canBeWrap = checkWrapSequence(tiles, okeyRef);
  if (canBeWrap.valid) {
    return canBeWrap;
  }

  return { valid: false, score: 0 };
};

function checkStandardSequence(tiles: Tile101[], okeyRef?: Tile101 | null): { valid: boolean; score: number } {
  const len = tiles.length;
  // Try all possible starting values for tile[0]
  for (let startNum = 1; startNum <= 14 - len; startNum++) {
    let match = true;
    let score = 0;
    for (let i = 0; i < len; i++) {
      const expectedNum = startNum + i;
      const tile = tiles[i];
      if (isTileOkey(tile, okeyRef)) {
        score += expectedNum;
      } else {
        if (tile.number !== expectedNum) {
          match = false;
          break;
        }
        score += tile.number;
      }
    }
    if (match) {
      return { valid: true, score };
    }
  }
  return { valid: false, score: 0 };
}

function checkWrapSequence(tiles: Tile101[], okeyRef?: Tile101 | null): { valid: boolean; score: number } {
  const len = tiles.length;
  // In Okey, wrap only allows 1 AFTER 13 (e.g. 11-12-13-1 or 12-13-1).
  // The last tile must be 1, preceding must be 13, etc.
  const lastTile = tiles[len - 1];
  if (!isTileOkey(lastTile, okeyRef) && lastTile.number !== 1) {
    return { valid: false, score: 0 };
  }

  let match = true;
  let score = 0;
  for (let i = 0; i < len; i++) {
    const tile = tiles[i];
    let expectedNum = 0;
    if (i === len - 1) {
      expectedNum = 1;
    } else {
      expectedNum = 14 - (len - i); // e.g. for len=3: i=0 -> 12, i=1 -> 13
    }

    if (expectedNum < 1 || expectedNum > 13) {
      match = false;
      break;
    }

    if (isTileOkey(tile, okeyRef)) {
      score += expectedNum;
    } else {
      if (tile.number !== expectedNum) {
        match = false;
        break;
      }
      score += tile.number;
    }
  }

  if (match) {
    return { valid: true, score };
  }

  return { valid: false, score: 0 };
}

/**
 * Validate a Group meld (Aynı Sayı Per)
 * 3 or 4 tiles of the same number, but all different colors.
 */
export const isValidGroup = (tiles: Tile101[], okeyRef?: Tile101 | null): { valid: boolean; score: number } => {
  if (!tiles || tiles.length < 3 || tiles.length > 4) return { valid: false, score: 0 };

  const regulars = tiles.filter((t) => !isTileOkey(t, okeyRef));

  if (regulars.length === 0) {
    return { valid: true, score: tiles.length * 10 };
  }

  const groupNumber = regulars[0].number;
  if (regulars.some((t) => t.number !== groupNumber)) {
    return { valid: false, score: 0 };
  }

  // Check unique colors
  const colorsUsed = new Set<TileColor>();
  for (const r of regulars) {
    if (colorsUsed.has(r.color)) return { valid: false, score: 0 };
    colorsUsed.add(r.color);
  }

  const score = tiles.length * groupNumber;
  return { valid: true, score };
};

/**
 * Check if a single meld is either a valid run or a valid group
 */
export const validateMeld = (
  tiles: Tile101[],
  okeyRef?: Tile101 | null
): { valid: boolean; type: 'run' | 'group' | null; score: number } => {
  const runCheck = isValidRun(tiles, okeyRef);
  if (runCheck.valid) {
    return { valid: true, type: 'run', score: runCheck.score };
  }
  const groupCheck = isValidGroup(tiles, okeyRef);
  if (groupCheck.valid) {
    return { valid: true, type: 'group', score: groupCheck.score };
  }
  return { valid: false, type: null, score: 0 };
};

/**
 * Check if a pair is valid (same number, same color, or 1 regular + 1 okey)
 */
export const isValidPair = (tile1: Tile101, tile2: Tile101, okeyRef?: Tile101 | null): boolean => {
  if (!tile1 || !tile2) return false;
  const okey1 = isTileOkey(tile1, okeyRef);
  const okey2 = isTileOkey(tile2, okeyRef);

  if (okey1 || okey2) return true;
  return tile1.number === tile2.number && tile1.color === tile2.color;
};

/**
 * Validate Pair Opening (Çift Açma):
 * Must have at least 5 valid pairs (10 tiles). In katlamalı, must exceed highestPairsCount.
 */
export const validatePairOpening = (
  pairs: Tile101[][],
  okeyRef?: Tile101 | null,
  minPairsNeeded: number = 5
): { valid: boolean; error?: string } => {
  const minRequired = Math.max(5, minPairsNeeded || 5);
  if (!pairs || pairs.length < minRequired) {
    return { valid: false, error: `Çift açmak için en az ${minRequired} çift (${minRequired * 2} taş) gereklidir.` };
  }

  for (let i = 0; i < pairs.length; i++) {
    const p = pairs[i];
    if (p.length !== 2) {
      return { valid: false, error: `${i + 1}. grupta tam olarak 2 taş olmalıdır.` };
    }
    if (!isValidPair(p[0], p[1], okeyRef)) {
      return { valid: false, error: `${i + 1}. çift geçersizdir (aynı renk ve sayı olmalı).` };
    }
  }

  return { valid: true };
};

/**
 * Validate Serial Hand Opening (Seri Açma):
 * Melds must all be valid runs/groups, and total score must meet requirement.
 */
export const validateSerialHandOpening = (
  melds: Tile101[][],
  minScoreNeeded: number,
  okeyRef?: Tile101 | null
): { valid: boolean; totalScore: number; verifiedMelds: Okey101Meld[]; error?: string } => {
  if (!melds || melds.length === 0) {
    return { valid: false, totalScore: 0, verifiedMelds: [], error: 'Açılacak per bulunamadı.' };
  }

  let totalScore = 0;
  const verifiedMelds: Okey101Meld[] = [];

  for (let i = 0; i < melds.length; i++) {
    const meldTiles = melds[i];
    const check = validateMeld(meldTiles, okeyRef);
    if (!check.valid || !check.type) {
      return {
        valid: false,
        totalScore: 0,
        verifiedMelds: [],
        error: `${i + 1}. per geçersizdir. Ardışık seri veya aynı sayı farklı renk olmalıdır.`,
      };
    }
    totalScore += check.score;
    verifiedMelds.push({
      id: `meld_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
      playerId: 0,
      playerUsername: '',
      type: check.type,
      tiles: [...meldTiles],
      score: check.score,
    });
  }

  if (totalScore < minScoreNeeded) {
    return {
      valid: false,
      totalScore,
      verifiedMelds: [],
      error: `Perlerin toplam puanı (${totalScore}), gerekli baraj puanını (${minScoreNeeded}) karşılamıyor.`,
    };
  }

  return { valid: true, totalScore, verifiedMelds };
};

/**
 * Check if a player's tile can be appended/processed onto an existing meld on the table.
 * - For Run: can be placed at the beginning or at the end.
 * - For Group: can be added if group has 3 tiles and this tile has the same number with the unused color.
 */
export const canAppendTileToMeld = (
  tile: Tile101,
  meld: Okey101Meld,
  okeyRef?: Tile101 | null
): { canAppend: boolean; insertAt?: 'start' | 'end'; error?: string } => {
  if (!tile || !meld || !meld.tiles) return { canAppend: false };

  // Group Meld Appending (Max 4 tiles)
  if (meld.type === 'group') {
    if (meld.tiles.length >= 4) {
      return { canAppend: false, error: 'Bu grupta zaten 4 farklı renk tamamlanmış.' };
    }

    const okey = isTileOkey(tile, okeyRef);
    const regulars = meld.tiles.filter((t) => !isTileOkey(t, okeyRef));
    const targetNumber = regulars.length > 0 ? regulars[0].number : 10;

    if (!okey && tile.number !== targetNumber) {
      return { canAppend: false, error: `Bu gruba sadece ${targetNumber} numaralı taş eklenebilir.` };
    }

    const existingColors = new Set(meld.tiles.map((t) => t.color));
    if (!okey && existingColors.has(tile.color)) {
      return { canAppend: false, error: 'Bu renk zaten bu grupta bulunuyor.' };
    }

    return { canAppend: true, insertAt: 'end' };
  }

  // Run Meld Appending (Min 3, Max 13)
  if (meld.type === 'run') {
    if (meld.tiles.length >= 13) {
      return { canAppend: false, error: 'Bu seri maksimum uzunluğa ulaşmış.' };
    }

    // Try prepending tile
    const prependTest = [tile, ...meld.tiles];
    if (isValidRun(prependTest, okeyRef).valid) {
      return { canAppend: true, insertAt: 'start' };
    }

    // Try appending tile
    const appendTest = [...meld.tiles, tile];
    if (isValidRun(appendTest, okeyRef).valid) {
      return { canAppend: true, insertAt: 'end' };
    }

    return { canAppend: false, error: 'Bu taş bu serinin başına veya sonuna uymuyor.' };
  }

  return { canAppend: false };
};

/**
 * "İşler Taş" Check:
 * Returns true if the tile could have been processed/appended to ANY opened meld on the table.
 * If true, throwing this tile causes a +101 penalty!
 */
export const checkIslerTas = (
  tile: Tile101,
  openedMelds: Okey101Meld[],
  okeyRef?: Tile101 | null
): boolean => {
  if (!tile || !openedMelds || openedMelds.length === 0) return false;
  // Real Okey is never treated as punishable işler taş
  if (isTileOkey(tile, okeyRef)) return false;

  for (const meld of openedMelds) {
    const res = canAppendTileToMeld(tile, meld, okeyRef);
    if (res.canAppend) return true;
  }
  return false;
};

/**
 * Calculate round end penalties according to official 101 Okey rules:
 * - Winner: -101 (or -202 if finished with Okey or by Double)
 * - Unopened players: +202 (plus +101 for each Okey left in hand)
 * - Opened players: sum of values of remaining tiles in hand (plus +101 for each Okey left in hand)
 * - Double openers (Çift açanlar): penalty is multiplied by 2 (hand sum x2, Okey left x2)
 * - Okey finish or Double finish by winner: multiplies all opponents' penalties by 2 (x2)
 */
export const calculateRoundPenalties = (
  players: Okey101Player[],
  winnerId: number,
  finishedWithOkey: boolean,
  okeyRef?: Tile101 | null,
  finishedWithDouble: boolean = false
): { [playerId: number]: { roundScore: number; reason: string } } => {
  const result: { [playerId: number]: { roundScore: number; reason: string } } = {};

  const winner = players.find((p) => p.id === winnerId);
  const isDoubleWin = finishedWithDouble || (winner && winner.openedMode === 'double');

  for (const p of players) {
    if (p.id === winnerId) {
      if (finishedWithOkey && isDoubleWin) {
        result[p.id] = {
          roundScore: -202,
          reason: 'Çifte giderek Okey ile bitirdi! (-202 puan)',
        };
      } else if (finishedWithOkey) {
        result[p.id] = {
          roundScore: -202,
          reason: 'Okey atarak bitirdi! (-202 puan)',
        };
      } else if (isDoubleWin) {
        result[p.id] = {
          roundScore: -202,
          reason: 'Çifte giderek bitirdi! (-202 puan)',
        };
      } else {
        result[p.id] = {
          roundScore: -101,
          reason: 'Eli normal bitirdi (-101 puan)',
        };
      }
      continue;
    }

    let penalty = 0;
    let reason = '';

    // Check count of unplayed real Okeys left in hand (+101 penalty per Okey)
    const okeysInHand = p.hand ? p.hand.filter((t) => isTileOkey(t, okeyRef)).length : 0;
    const okeyPenalty = okeysInHand * 101;

    if (!p.hasOpened) {
      // Unopened: +202 base penalty
      penalty = 202 + okeyPenalty;
      reason = okeysInHand > 0
        ? `El açamadı (+202) + Elde ${okeysInHand} Okey kaldı (+${okeyPenalty})`
        : 'El açamadı (+202 ceza)';
    } else if (p.openedMode === 'double') {
      // Opened double (Çift açanlar): Hand sum x 2 + Okey left x 2
      const handSum = (p.hand || []).reduce((sum, t) => {
        if (isTileOkey(t, okeyRef)) return sum;
        return sum + (t.number || 0);
      }, 0);
      penalty = (handSum * 2) + (okeyPenalty * 2);
      reason = okeysInHand > 0
        ? `Çift açan eldeki taşlar x2 (${handSum * 2}) + Elde Okey x2 (+${okeyPenalty * 2})`
        : `Çift açan oyuncunun kalan taşları x2 (${handSum * 2} ceza)`;
    } else {
      // Opened serial: Sum of remaining tiles in hand + Okey penalty
      const handSum = (p.hand || []).reduce((sum, t) => {
        if (isTileOkey(t, okeyRef)) return sum;
        return sum + (t.number || 0);
      }, 0);
      penalty = handSum + okeyPenalty;
      reason = okeysInHand > 0
        ? `Kalan taşlar (${handSum}) + Elde ${okeysInHand} Okey kaldı (+${okeyPenalty})`
        : `Eldeki kalan taşlar toplamı (${handSum} ceza)`;
    }

    // Multiply by 2 if winner finished with Okey
    if (finishedWithOkey) {
      penalty *= 2;
      reason += ' (Okey ile bitiş x2)';
    } else if (isDoubleWin) {
      penalty *= 2;
      reason += ' (Çifte giderek bitiş x2)';
    }

    result[p.id] = { roundScore: penalty, reason };
  }

  return result;
};

/**
 * Auto-find best runs and groups in player's hand and calculate potential meld score.
 * Tests multiple extraction orders (runs-first vs groups-first) and selects the partition with the maximum score.
 */
export const findBestMeldsInHand = (
  hand: Tile101[],
  okeyRef?: Tile101 | null
): { melds: Tile101[][]; totalScore: number; unmelded: Tile101[] } => {
  if (!hand || hand.length === 0) return { melds: [], totalScore: 0, unmelded: [] };

  const solveMelds = (prioritizeRuns: boolean) => {
    const available = [...hand];
    const melds: Tile101[][] = [];
    let totalScore = 0;

    const findRuns = () => {
      const colors: TileColor[] = ['red', 'blue', 'black', 'yellow'];
      for (const c of colors) {
        const colorTiles = available.filter((t) => t.color === c && !isTileOkey(t, okeyRef));
        colorTiles.sort((a, b) => a.number - b.number);

        // Check for wrapping runs (11-12-13-1 or 12-13-1)
        const hasOne = colorTiles.find((t) => t.number === 1);
        const hasThirteen = colorTiles.find((t) => t.number === 13);
        const hasTwelve = colorTiles.find((t) => t.number === 12);
        const hasEleven = colorTiles.find((t) => t.number === 11);

        if (hasOne && hasThirteen && hasTwelve) {
          const wrapRun = hasEleven
            ? [hasEleven, hasTwelve, hasThirteen, hasOne]
            : [hasTwelve, hasThirteen, hasOne];
          const check = isValidRun(wrapRun, okeyRef);
          if (check.valid) {
            melds.push([...wrapRun]);
            totalScore += check.score;
            for (const t of wrapRun) {
              const idx = available.findIndex((at) => at.id === t.id);
              if (idx !== -1) available.splice(idx, 1);
            }
          }
        }

        // Standard consecutive runs
        const remainingColorTiles = available.filter((t) => t.color === c && !isTileOkey(t, okeyRef));
        remainingColorTiles.sort((a, b) => a.number - b.number);

        let currentRun: Tile101[] = [];
        for (let i = 0; i < remainingColorTiles.length; i++) {
          if (currentRun.length === 0) {
            currentRun.push(remainingColorTiles[i]);
          } else {
            const last = currentRun[currentRun.length - 1];
            if (remainingColorTiles[i].number === last.number + 1) {
              currentRun.push(remainingColorTiles[i]);
            } else if (remainingColorTiles[i].number === last.number) {
              continue;
            } else {
              if (currentRun.length >= 3) {
                const check = isValidRun(currentRun, okeyRef);
                if (check.valid) {
                  melds.push([...currentRun]);
                  totalScore += check.score;
                  for (const t of currentRun) {
                    const idx = available.findIndex((at) => at.id === t.id);
                    if (idx !== -1) available.splice(idx, 1);
                  }
                }
              }
              currentRun = [remainingColorTiles[i]];
            }
          }
        }
        if (currentRun.length >= 3) {
          const check = isValidRun(currentRun, okeyRef);
          if (check.valid) {
            melds.push([...currentRun]);
            totalScore += check.score;
            for (const t of currentRun) {
              const idx = available.findIndex((at) => at.id === t.id);
              if (idx !== -1) available.splice(idx, 1);
            }
          }
        }
      }
    };

    const findGroups = () => {
      for (let num = 13; num >= 1; num--) {
        const numTiles = available.filter((t) => t.number === num && !isTileOkey(t, okeyRef));
        const uniqueColorTiles: Tile101[] = [];
        const usedColors = new Set<TileColor>();
        for (const t of numTiles) {
          if (!usedColors.has(t.color)) {
            usedColors.add(t.color);
            uniqueColorTiles.push(t);
          }
        }

        if (uniqueColorTiles.length >= 3) {
          const check = isValidGroup(uniqueColorTiles, okeyRef);
          if (check.valid) {
            melds.push(uniqueColorTiles);
            totalScore += check.score;
            for (const t of uniqueColorTiles) {
              const idx = available.findIndex((at) => at.id === t.id);
              if (idx !== -1) available.splice(idx, 1);
            }
          }
        }
      }
    };

    if (prioritizeRuns) {
      findRuns();
      findGroups();
    } else {
      findGroups();
      findRuns();
    }

    return { melds, totalScore, unmelded: available };
  };

  const solutionA = solveMelds(true);
  const solutionB = solveMelds(false);

  return solutionA.totalScore >= solutionB.totalScore ? solutionA : solutionB;
};

/**
 * Auto-find pairs in hand (for Çift Açma)
 */
export const findPairsInHand = (
  hand: Tile101[],
  okeyRef?: Tile101 | null
): { pairs: Tile101[][]; unmelded: Tile101[] } => {
  const available = [...hand];
  const pairs: Tile101[][] = [];

  for (let i = 0; i < available.length; i++) {
    for (let j = i + 1; j < available.length; j++) {
      if (isValidPair(available[i], available[j], okeyRef)) {
        pairs.push([available[i], available[j]]);
        available.splice(j, 1);
        available.splice(i, 1);
        i--;
        break;
      }
    }
  }

  return { pairs, unmelded: available };
};

/**
 * High-level engine interface for room initialization and rule validation
 */
export const Okey101Engine = {
  generate101Deck,
  deal101Hands,
  isValidRun,
  isValidGroup,
  validateMeld,
  isValidPair,
  validatePairOpening,
  validateSerialHandOpening,
  canAppendTileToMeld,
  checkIslerTas,
  calculateRoundPenalties,
  findBestMeldsInHand,
  findPairsInHand,
  isTileOkey,
  initializeGame: (room: any) => {
    const { deck, indicator, okeyTile } = generate101Deck();
    const dealerIndex = 0;
    const dealt = deal101Hands(deck, dealerIndex, room.players?.length || 4);

    room.deck = dealt.remainingDeck;
    room.indicator = indicator;
    room.okeyTile = okeyTile;
    room.status = 'playing';
    room.currentTurn = 0;
    room.turnPhase = 'discard'; // First player has 22 tiles and starts by discarding
    room.highestOpenScore = 101;
    room.openedMelds = [];
    room.winnerId = undefined;
    room.winningReason = undefined;
    room.roundNumber = (room.roundNumber || 0) + 1;
    room.lastActionMessage = `101 Okey başladı! Gösterge: ${indicator.number} (${indicator.color}). İlk sıra ${room.players[0]?.username || '1. Oyuncu'} adlı oyuncuda.`;

    for (let i = 0; i < room.players.length; i++) {
      room.players[i].hand = dealt.hands[i] || [];
      room.players[i].discardPile = [];
      room.players[i].hasOpened = false;
      room.players[i].openedMode = undefined;
      room.players[i].openedScore = 0;
      room.players[i].openedMeldsCount = 0;
      room.players[i].roundPenalty = 0;
    }

    return { dealt, indicator, okeyTile };
  }
};
