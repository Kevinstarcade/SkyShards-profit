import { describe, expect, it, vi } from "vitest";
import { BazaarSnapshotCache, createBazaarPriceSnapshot } from "./bazaarSnapshotCache";
import type { BazaarData } from "../types/hypixelApiTypes";
import type { Shard } from "../types/types";

const snapshot = (fetchedAt: number) => ({ fetchedAt, prices: {} });

describe("BazaarSnapshotCache", () => {
  it("reuses a fresh snapshot and refreshes after the TTL", async () => {
    let now = 1_000;
    const loader = vi.fn(async () => snapshot(now));
    const cache = new BazaarSnapshotCache(loader, { ttlMs: 60_000, now: () => now });

    await expect(cache.get()).resolves.toEqual(snapshot(1_000));
    now = 30_000;
    await cache.get();
    expect(loader).toHaveBeenCalledTimes(1);

    now = 61_001;
    await cache.get();
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("shares an in-flight request between concurrent callers", async () => {
    let resolve!: (value: ReturnType<typeof snapshot>) => void;
    const loader = vi.fn(() => new Promise<ReturnType<typeof snapshot>>((done) => (resolve = done)));
    const cache = new BazaarSnapshotCache(loader);

    const first = cache.get();
    const second = cache.get();
    expect(loader).toHaveBeenCalledTimes(1);
    resolve(snapshot(Date.now()));

    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
  });

  it("supports a forced refresh", async () => {
    const loader = vi.fn(async () => snapshot(Date.now()));
    const cache = new BazaarSnapshotCache(loader);

    await cache.get();
    await cache.get(true);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("does not poison the cache after a failed load", async () => {
    const loader = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(snapshot(Date.now()));
    const cache = new BazaarSnapshotCache(loader);

    await expect(cache.get()).rejects.toThrow("offline");
    await expect(cache.get()).resolves.toBeDefined();
    expect(loader).toHaveBeenCalledTimes(2);
  });
});


describe("createBazaarPriceSnapshot", () => {
  it("stores both quick_status sides under the shard id", () => {
    const data = {
      success: true,
      lastUpdated: 900,
      products: { ITEM_A: { productId: "ITEM_A", sell_summary: {}, buy_summary: {}, quick_status: { productId: "ITEM_A", buyPrice: 12, sellPrice: 9, buyVolume: 0, sellVolume: 0, buyMovingWeek: 0, sellMovingWeek: 0, buyOrders: 0, sellOrders: 0 } } },
    } satisfies BazaarData;
    const shards = [{ id: "A", internal_id: "ITEM_A" } as Shard];
    expect(createBazaarPriceSnapshot(data, shards, 1_000)).toEqual({
      fetchedAt: 1_000,
      sourceUpdatedAt: 900,
      prices: { A: { buyPrice: 12, sellPrice: 9 } },
    });
  });
});
