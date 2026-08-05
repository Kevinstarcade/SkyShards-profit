import { describe, expect, it } from "vitest";
import type { FusionJson, Shard } from "../types/types";
import type { BazaarPriceSnapshot, ProfitCalculationInput } from "../types/profitTypes";
import { BAZAAR_TAX_RATE } from "../types/profitTypes";
import { ProfitCalculationService, getBuyPrice, getSellPrice, sortProfitResults } from "./profitCalculationService";

const shard = (id: string, fuseAmount = 5, family = "Aquatic"): Shard => ({
  id,
  name: id,
  family,
  type: "Test",
  rarity: "common",
  fuse_amount: fuseAmount,
  internal_id: id,
  rate: 1,
});

const fusionJson: FusionJson = {
  shards: {
    A: shard("A"),
    B: shard("B"),
    C: shard("C"),
    D: shard("D"),
  },
  recipes: {
    C: { "2": [["A", "B"]] },
    D: { "2": [["C", "A"]] },
  },
};

const snapshot: BazaarPriceSnapshot = {
  fetchedAt: 1_000,
  prices: {
    A: { buyPrice: 10, sellPrice: 8 },
    B: { buyPrice: 10, sellPrice: 8 },
    C: { buyPrice: 100, sellPrice: 80 },
    D: { buyPrice: 300, sellPrice: 200 },
  },
};

const input = (overrides: Partial<ProfitCalculationInput> = {}): ProfitCalculationInput => ({
  fusionJson,
  defaultRates: { A: 1, B: 1, C: 1, D: 1 },
  snapshot,
  buyMode: "instant-buy",
  sellMode: "instant-sell",
  crocodileLevel: 0,
  ...overrides,
});

describe("Bazaar side mapping", () => {
  it("supports all four independent buy and sell combinations", () => {
    expect(getBuyPrice(snapshot, "A", "instant-buy")).toBe(10);
    expect(getBuyPrice(snapshot, "A", "buy-offer")).toBe(8);
    expect(getSellPrice(snapshot, "A", "instant-sell")).toBe(8);
    expect(getSellPrice(snapshot, "A", "sell-offer")).toBe(10);
  });
});

describe("ProfitCalculationService", () => {
  it("uses recursively fused ingredients and applies the 1.25% selling tax", () => {
    const result = new ProfitCalculationService().calculate(input());
    const d = result.normalResults.find((entry) => entry.shardId === "D");

    expect(d).toBeDefined();
    expect(d!.fusionCostPerShard).toBeCloseTo(150);
    expect(d!.profitPerShard).toBeCloseTo(200 * (1 - BAZAAR_TAX_RATE) - 150);
    expect(d!.batchOutput).toBe(2);
    expect(d!.batchCost).toBeCloseTo(350);
    expect(d!.materials.map((material) => [material.shardId, material.quantity])).toEqual([
      ["A", 20],
      ["B", 15],
    ]);
  });

  it("excludes outputs when direct purchase is cheaper", () => {
    const cheaperDirect = structuredClone(snapshot);
    cheaperDirect.prices.C.buyPrice = 40;
    const result = new ProfitCalculationService().calculate(input({ snapshot: cheaperDirect }));
    expect(result.normalResults.some((entry) => entry.shardId === "C")).toBe(false);
  });

  it("excludes after-tax losses", () => {
    const losing = structuredClone(snapshot);
    losing.prices.C.sellPrice = 50;
    const result = new ProfitCalculationService().calculate(input({ snapshot: losing }));
    expect(result.normalResults.some((entry) => entry.shardId === "C")).toBe(false);
  });

  it("sorts by profit per shard or ROI", () => {
    const result = new ProfitCalculationService().calculate(input()).normalResults;
    expect(sortProfitResults(result, "profit")[0].profitPerShard).toBeGreaterThanOrEqual(sortProfitResults(result, "profit")[1].profitPerShard);
    expect(sortProfitResults(result, "roi")[0].roi).toBeGreaterThanOrEqual(sortProfitResults(result, "roi")[1].roi);
  });

  it("finds a profitable Crocodile-enabled cycle in a dedicated result list", () => {
    const cycleJson: FusionJson = {
      shards: {
        X: shard("X", 1, "Reptile"),
        F: shard("F", 1, "Aquatic"),
      },
      recipes: { X: { "1": [["X", "F"]] } },
    };
    const cycleSnapshot: BazaarPriceSnapshot = {
      fetchedAt: 1,
      prices: {
        X: { buyPrice: 100, sellPrice: 80 },
        F: { buyPrice: 1, sellPrice: 1 },
      },
    };
    const result = new ProfitCalculationService().calculate({
      fusionJson: cycleJson,
      defaultRates: { X: 1, F: 1 },
      snapshot: cycleSnapshot,
      buyMode: "instant-buy",
      sellMode: "instant-sell",
      crocodileLevel: 10,
    });

    expect(result.cycleResults).toHaveLength(1);
    expect(result.cycleResults[0].kind).toBe("cycle");
    expect(result.cycleResults[0].profitPerShard).toBeGreaterThan(0);
    expect(result.cycleResults[0].batchCost).toBe(1);
    expect(result.cycleResults[0].materials.map((material) => material.shardId)).toEqual(["F"]);
  });
});
