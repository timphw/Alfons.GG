/** Minimaler asynchroner Key-Value-Cache (In-Memory oder Redis). */
export interface Cache {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
}

export class MemoryCache implements Cache {
  private store = new Map<string, { value: unknown; expiresAt: number }>();
  constructor(
    private readonly maxEntries = 5000,
    private readonly now: () => number = Date.now,
  ) {}

  async get<T>(key: string): Promise<T | undefined> {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= this.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.store.delete(key);
    if (this.store.size >= this.maxEntries) {
      // ältesten Eintrag (Insertion-Order) verwerfen
      const first = this.store.keys().next().value;
      if (first !== undefined) this.store.delete(first);
    }
    this.store.set(key, { value, expiresAt: this.now() + ttlSeconds * 1000 });
  }
}
