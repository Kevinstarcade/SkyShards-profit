import type { CalculationParams, Data, Recipe, RecipeTree, Shard } from "./types";

export const BAZAAR_TAX_RATE = 0.0125;

export type ProfitBuyMode = "instant-buy" | "buy-offer";
export type ProfitSellMode = "instant-sell" | "sell-offer";
export type ProfitSortMode = "profit" | "roi";

export interface BazaarShardPrice {
  buyPrice?: number;
  sellPrice?: number;
}

export interface BazaarPriceSnapshot {
  prices: Record<string, BazaarShardPrice>;
  fetchedAt: number;
  sourceUpdatedAt?: number;
}

export interface ProfitPreferences {
  buyMode: ProfitBuyMode;
  sellMode: ProfitSellMode;
  sortMode: ProfitSortMode;
}

export interface ProfitMaterial {
  shardId: string;
  quantity: number;
  unitPrice: number;
  totalCost: number;
}

export interface FusionProfitResult {
  shardId: string;
  shard: Shard;
  kind: "normal" | "cycle";
  recipe: Recipe | null;
  cycleShards?: string[];
  directPurchaseCost: number;
  fusionCostPerShard: number;
  grossSalePricePerShard: number;
  netSalePricePerShard: number;
  profitPerShard: number;
  roi: number;
  batchOutput: number;
  batchCost: number;
  saleRevenue: number;
  netProfit: number;
  craftsNeeded: number;
  materials: ProfitMaterial[];
  tree: RecipeTree;
}

export interface ProfitCalculationInput {
  fusionJson: import("./types").FusionJson;
  defaultRates: Record<string, number>;
  snapshot: BazaarPriceSnapshot;
  buyMode: ProfitBuyMode;
  sellMode: ProfitSellMode;
  crocodileLevel: number;
}

export interface ProfitCalculationOutput {
  data: Data;
  params: CalculationParams;
  normalResults: FusionProfitResult[];
  cycleResults: FusionProfitResult[];
  snapshotFetchedAt: number;
  sourceUpdatedAt?: number;
  excluded: {
    missingBuyPrice: number;
    missingSellPrice: number;
    directWasCheaper: number;
    nonPositiveProfit: number;
  };
}
