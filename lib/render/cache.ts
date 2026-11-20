/**
 * Bounded LRU cache of rendered stage ImageBitmaps keyed by stage + quantized params.
 * Properly closes evicted ImageBitmaps so scrubbing stays 60fps without leaking GPU RAM.
 */
export class StageBitmapCache {
  private map = new Map<string, ImageBitmap>();
  private maxEntries: number;

  constructor(maxEntries = 48) {
    this.maxEntries = maxEntries;
  }

  get(key: string): ImageBitmap | undefined {
    const found = this.map.get(key);
    if (!found) return undefined;
    // Refresh recency
    this.map.delete(key);
    this.map.set(key, found);
    return found;
  }

  set(key: string, bitmap: ImageBitmap): void {
    const prev = this.map.get(key);
    if (prev && prev !== bitmap) {
      prev.close();
      this.map.delete(key);
    }
    this.map.set(key, bitmap);

    while (this.map.size > this.maxEntries) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey === undefined) break;
      const oldest = this.map.get(oldestKey);
      oldest?.close();
      this.map.delete(oldestKey);
    }
  }

  clear(): void {
    for (const bmp of this.map.values()) {
      bmp.close();
    }
    this.map.clear();
  }
}

export const stageBitmapCache = new StageBitmapCache(48);
