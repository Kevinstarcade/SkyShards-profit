import type { BazaarData } from "../types/hypixelApiTypes";
import type { BazaarPriceSnapshot } from "../types/profitTypes";
import type { Shard } from "../types/types";

export interface BazaarSnapshotCacheOptions {
  ttlMs?: number;
  now?: () => number;
}

export class BazaarSnapshotCache {
  private readonly loader: () => Promise<BazaarPriceSnapshot>;
  private snapshot: BazaarPriceSnapshot | null = null;
  private inFlight: Promise<BazaarPriceSnapshot> | null = null;
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(loader: () => Promise<BazaarPriceSnapshot>, options: BazaarSnapshotCacheOptions = {}) {
    this.loader = loader;
    this.ttlMs = options.ttlMs ?? 60_000;
    this.now = options.now ?? Date.now;
  }

  getCached(): BazaarPriceSnapshot | null {
    return this.snapshot;
  }

  isFresh(snapshot: BazaarPriceSnapshot | null = this.snapshot): boolean {
    return snapshot !== null && this.now() - snapshot.fetchedAt < this.ttlMs;
  }

  clear(): void {
    this.snapshot = null;
  }

  async get(forceRefresh = false): Promise<BazaarPriceSnapshot> {
    if (!forceRefresh && this.isFresh()) {
      return this.snapshot!;
    }
    if (this.inFlight) {
      return this.inFlight;
    }

    this.inFlight = this.loader()
      .then((snapshot) => {
        this.snapshot = snapshot;
        return snapshot;
      })
      .finally(() => {
        this.inFlight = null;
      });

    return this.inFlight;
  }
}

export const createBazaarPriceSnapshot = (
  bazaarData: BazaarData,
  shards: Shard[],
  fetchedAt = Date.now()
): BazaarPriceSnapshot => {
  const prices: BazaarPriceSnapshot["prices"] = {};
  for (const shard of shards) {
    const quickStatus = bazaarData.products[shard.internal_id]?.quick_status;
    if (!quickStatus) continue;
    const buyPrice = Number.isFinite(quickStatus.buyPrice) && quickStatus.buyPrice > 0 ? quickStatus.buyPrice : undefined;
    const sellPrice = Number.isFinite(quickStatus.sellPrice) && quickStatus.sellPrice > 0 ? quickStatus.sellPrice : undefined;
    if (buyPrice !== undefined || sellPrice !== undefined) prices[shard.id] = { buyPrice, sellPrice };
  }
  return { prices, fetchedAt, sourceUpdatedAt: bazaarData.lastUpdated };
};
