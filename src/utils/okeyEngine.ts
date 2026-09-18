export type TileColor = 'red' | 'blue' | 'black' | 'yellow' | 'fake';
export interface Tile {
  id: string;
  number: number;
  color: TileColor;
}

// 1. Seri Per: Aynı renk, ardışık sayılar (örn: Kırmızı 9-10-11, 11-12-13-1)
export const isSerialMeld = (tiles: Tile[]): boolean => {
  if (tiles.length < 3) return false;
  const color = tiles[0].color;
  if (color === 'fake') return false;
  
  // Sort by number
  let sorted = [...tiles].sort((a, b) => a.number - b.number);
  
  // Check if they are all same color
  if (sorted.some(t => t.color !== color)) return false;

  // Handle 12-13-1 case
  if (sorted[0].number === 1 && sorted[sorted.length - 1].number === 13) {
    // move 1 to the end temporarily to check sequence
    const one = sorted.shift();
    if (one) {
      one.number = 14; 
      sorted.push(one);
      sorted = sorted.sort((a, b) => a.number - b.number);
    }
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].number + 1 !== sorted[i+1].number) {
      return false;
    }
  }
  return true;
};

// 2. Renk Peri (Grup): Farklı renk, aynı sayılar (örn: Siyah 7, Mavi 7, Kırmızı 7)
export const isGroupMeld = (tiles: Tile[]): boolean => {
  if (tiles.length < 3 || tiles.length > 4) return false;
  const num = tiles[0].number;
  const seenColors = new Set<TileColor>();
  
  for (const t of tiles) {
    if (t.number !== num) return false;
    if (seenColors.has(t.color)) return false;
    seenColors.add(t.color);
  }
  return true;
};

// 3. Çiftler: Aynı renk ve aynı sayı (örn: 2 tane Sarı 5)
export const isPair = (tiles: Tile[]): boolean => {
  if (tiles.length !== 2) return false;
  return tiles[0].number === tiles[1].number && tiles[0].color === tiles[1].color;
};

// 101 Modu: Toplam hesaplama
export const calculateMeldSum = (tiles: Tile[]): number => {
  return tiles.reduce((sum, tile) => sum + (tile.number === 1 ? 11 : tile.number), 0);
};

export const check101Open = (melds: Tile[][]): { valid: boolean, sum: number, isPairOpener: boolean } => {
  let allPairs = true;
  let totalSum = 0;

  for (const meld of melds) {
    if (isPair(meld)) {
      totalSum += meld[0].number * 2;
    } else if (isSerialMeld(meld) || isGroupMeld(meld)) {
      allPairs = false;
      totalSum += calculateMeldSum(meld);
    } else {
      return { valid: false, sum: 0, isPairOpener: false };
    }
  }

  if (allPairs && melds.length >= 5) {
    return { valid: true, sum: totalSum, isPairOpener: true };
  }

  if (!allPairs && totalSum >= 101) {
    return { valid: true, sum: totalSum, isPairOpener: false };
  }

  return { valid: false, sum: totalSum, isPairOpener: allPairs };
};
