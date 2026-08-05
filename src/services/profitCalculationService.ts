import { CalculationService } from "./calculationService";
import type { CalculationParams, Data, Recipe, RecipeChoice, RecipeTree } from "../types/types";
import type {
  BazaarPriceSnapshot,
  FusionProfitResult,
  ProfitBuyMode,
  ProfitCalculationInput,
  ProfitCalculationOutput,
  ProfitMaterial,
  ProfitSellMode,
  ProfitSortMode,
} from "../types/profitTypes";
import { BAZAAR_TAX_RATE } from "../types/profitTypes";

const COST_TOLERANCE = 1e-8;

type Solver = Pick<
  CalculationService,
  | "buildData"
  | "computeMinCosts"
  | "findCycleNodes"
  | "buildRecipeTree"
  | "assignQuantities"
  | "collectTreeStats"
  | "calculateMultipliers"
  | "getEffectiveOutputQuantity"
  | "computeCycleQuantities"
>;

export const getBuyPrice = (snapshot: BazaarPriceSnapshot, shardId: string, mode: ProfitBuyMode): number | undefined => {
  const price = snapshot.prices[shardId];
  return mode === "instant-buy" ? price?.buyPrice : price?.sellPrice;
};

export const getSellPrice = (snapshot: BazaarPriceSnapshot, shardId: string, mode: ProfitSellMode): number | undefined => {
  const price = snapshot.prices[shardId];
  return mode === "instant-sell" ? price?.sellPrice : price?.buyPrice;
};

export const sortProfitResults = (results: FusionProfitResult[], mode: ProfitSortMode): FusionProfitResult[] =>
  [...results].sort((a, b) => (mode === "roi" ? b.roi - a.roi : b.profitPerShard - a.profitPerShard));

export const buildProfitCalculationParams = (customRates: Record<string, number>, crocodileLevel: number): CalculationParams => ({
  customRates,
  hunterFortune: 0,
  excludeChameleon: false,
  frogBonus: false,
  newtLevel: 0,
  salamanderLevel: 0,
  lizardKingLevel: 0,
  leviathanLevel: 0,
  pythonLevel: 0,
  kingCobraLevel: 0,
  seaSerpentLevel: 0,
  tiamatLevel: 0,
  crocodileLevel,
  kuudraTier: "none",
  moneyPerHour: null,
  customKuudraTime: false,
  kuudraTimeSeconds: null,
  noWoodenBait: false,
  rateAsCoinValue: true,
  craftPenalty: 0,
});

const isFinitePositive = (value: number | undefined): value is number => value !== undefined && Number.isFinite(value) && value > 0;

const cycleKey = (cycle: string[], choices: Map<string, RecipeChoice>): string =>
  [...cycle]
    .sort()
    .map((shardId) => {
      const recipe = choices.get(shardId)?.recipe;
      return `${shardId}:${recipe?.inputs.join("+") ?? "direct"}:${recipe?.outputQuantity ?? 0}`;
    })
    .join("|");

export class ProfitCalculationService {
  private readonly solver: Solver;

  constructor(solver: Solver = CalculationService.getInstance()) {
    this.solver = solver;
  }

  calculate(input: ProfitCalculationInput): ProfitCalculationOutput {
    const directRates: Record<string, number> = {};
    for (const shardId of Object.keys(input.fusionJson.shards)) {
      const price = getBuyPrice(input.snapshot, shardId, input.buyMode);
      if (isFinitePositive(price)) directRates[shardId] = price;
    }

    const params = buildProfitCalculationParams(directRates, input.crocodileLevel);
    const data = this.solver.buildData(input.fusionJson, input.defaultRates, params);
    const { minCosts, choices } = this.solver.computeMinCosts(data, params);
    const baselineParams = { ...params, crocodileLevel: 0 };
    const baseline = input.crocodileLevel === 0 ? { minCosts, choices } : this.solver.computeMinCosts(data, baselineParams);
    const selectedCycles = this.solver.findCycleNodes(choices);
    const selectedCycleNodes = new Set(selectedCycles.flat());
    const excluded = { missingBuyPrice: 0, missingSellPrice: 0, directWasCheaper: 0, nonPositiveProfit: 0 };
    const normalResults: FusionProfitResult[] = [];

    for (const [shardId, choice] of choices) {
      if (!choice.recipe || selectedCycleNodes.has(shardId)) continue;
      const directPurchaseCost = directRates[shardId];
      if (!isFinitePositive(directPurchaseCost)) {
        excluded.missingBuyPrice++;
        continue;
      }
      const fusionCostPerShard = minCosts.get(shardId);
      if (!isFinitePositive(fusionCostPerShard) || fusionCostPerShard >= directPurchaseCost - COST_TOLERANCE) {
        excluded.directWasCheaper++;
        continue;
      }
      const grossSalePricePerShard = getSellPrice(input.snapshot, shardId, input.sellMode);
      if (!isFinitePositive(grossSalePricePerShard)) {
        excluded.missingSellPrice++;
        continue;
      }
      const netSalePricePerShard = grossSalePricePerShard * (1 - BAZAAR_TAX_RATE);
      const profitPerShard = netSalePricePerShard - fusionCostPerShard;
      if (profitPerShard <= COST_TOLERANCE) {
        excluded.nonPositiveProfit++;
        continue;
      }

      const result = this.buildNormalResult({
        shardId,
        recipe: choice.recipe,
        data,
        params,
        choices,
        minCosts,
        directRates,
        directPurchaseCost,
        fusionCostPerShard,
        grossSalePricePerShard,
        selectedCycles,
      });
      if (result) normalResults.push(result);
    }

    const cycleResults = this.buildCycleResults({
      input,
      data,
      params,
      normalChoices: choices,
      minCosts,
      directRates,
      baselineMinCosts: baseline.minCosts,
      baselineChoices: baseline.choices,
    });

    return {
      data,
      params,
      normalResults,
      cycleResults,
      snapshotFetchedAt: input.snapshot.fetchedAt,
      sourceUpdatedAt: input.snapshot.sourceUpdatedAt,
      excluded,
    };
  }

  private buildNormalResult(args: {
    shardId: string;
    recipe: Recipe;
    data: Data;
    params: CalculationParams;
    choices: Map<string, RecipeChoice>;
    minCosts: Map<string, number>;
    directRates: Record<string, number>;
    directPurchaseCost: number;
    fusionCostPerShard: number;
    grossSalePricePerShard: number;
    selectedCycles: string[][];
  }): FusionProfitResult | null {
    const crocodileMultiplier = this.solver.calculateMultipliers(args.params).crocodileMultiplier;
    const batchOutput = this.solver.getEffectiveOutputQuantity(args.recipe, crocodileMultiplier);
    const tree = this.solver.buildRecipeTree(args.data, args.shardId, args.choices, args.selectedCycles, args.params, [], {
      minCosts: args.minCosts,
      choices: args.choices,
    });
    this.solver.assignQuantities(tree, batchOutput, args.data, { total: 0 }, args.choices, crocodileMultiplier, args.params);
    const details = this.buildBatchDetails([tree], tree, batchOutput, args.params, args.directRates, args.grossSalePricePerShard);
    if (!details) return null;

    const netSalePricePerShard = args.grossSalePricePerShard * (1 - BAZAAR_TAX_RATE);
    const profitPerShard = netSalePricePerShard - args.fusionCostPerShard;
    return {
      shardId: args.shardId,
      shard: args.data.shards[args.shardId],
      kind: "normal",
      recipe: args.recipe,
      directPurchaseCost: args.directPurchaseCost,
      fusionCostPerShard: args.fusionCostPerShard,
      grossSalePricePerShard: args.grossSalePricePerShard,
      netSalePricePerShard,
      profitPerShard,
      roi: profitPerShard / args.fusionCostPerShard,
      batchOutput,
      ...details,
      tree,
    };
  }

  private buildBatchDetails(
    materialTrees: RecipeTree[],
    craftTree: RecipeTree,
    batchOutput: number,
    params: CalculationParams,
    directRates: Record<string, number>,
    grossSalePricePerShard: number
  ): Pick<FusionProfitResult, "batchCost" | "saleRevenue" | "netProfit" | "craftsNeeded" | "materials"> | null {
    const craftStats = this.solver.collectTreeStats(craftTree, params);
    const totalQuantities = this.collectConsumedMaterialQuantities(materialTrees);
    const materials: ProfitMaterial[] = [];
    let batchCost = 0;
    for (const [shardId, quantity] of totalQuantities) {
      const unitPrice = directRates[shardId];
      if (!isFinitePositive(unitPrice)) return null;
      const totalCost = quantity * unitPrice;
      batchCost += totalCost;
      materials.push({ shardId, quantity, unitPrice, totalCost });
    }
    materials.sort((a, b) => b.totalCost - a.totalCost);
    const saleRevenue = batchOutput * grossSalePricePerShard;
    const netProfit = saleRevenue * (1 - BAZAAR_TAX_RATE) - batchCost;
    return { batchCost, saleRevenue, netProfit, craftsNeeded: craftStats.craftsNeeded, materials };
  }

  private collectConsumedMaterialQuantities(trees: RecipeTree[]): Map<string, number> {
    const totalQuantities = new Map<string, number>();
    const traverse = (tree: RecipeTree) => {
      switch (tree.method) {
        case "direct":
          totalQuantities.set(tree.shard, (totalQuantities.get(tree.shard) ?? 0) + tree.quantity);
          break;
        case "recipe":
          tree.inputs.forEach(traverse);
          break;
        case "cycle":
          // The seed tree is returned after a loop and is working capital, not a consumed ingredient.
          tree.cycleInputs.forEach(traverse);
          break;
      }
    };
    trees.forEach(traverse);
    return totalQuantities;
  }

  private buildCycleResults(args: {
    input: ProfitCalculationInput;
    data: Data;
    params: CalculationParams;
    normalChoices: Map<string, RecipeChoice>;
    minCosts: Map<string, number>;
    directRates: Record<string, number>;
    baselineMinCosts: Map<string, number>;
    baselineChoices: Map<string, RecipeChoice>;
  }): FusionProfitResult[] {
    const candidateChoices = this.createCycleCandidateChoices(args.data, args.normalChoices, args.minCosts);
    const seenCycles = new Set<string>();
    const bestByOutput = new Map<string, FusionProfitResult>();
    const crocodileMultiplier = this.solver.calculateMultipliers(args.params).crocodileMultiplier;

    for (const choices of candidateChoices) {
      for (const cycle of this.solver.findCycleNodes(choices)) {
        const key = cycleKey(cycle, choices);
        if (seenCycles.has(key)) continue;
        seenCycles.add(key);

        for (const shardId of cycle) {
          const recipe = choices.get(shardId)?.recipe;
          const directPurchaseCost = args.directRates[shardId];
          const grossSalePricePerShard = getSellPrice(args.input.snapshot, shardId, args.input.sellMode);
          if (!recipe || !isFinitePositive(directPurchaseCost) || !isFinitePositive(grossSalePricePerShard)) continue;

          const steps = cycle
            .map((outputShard) => ({ outputShard, recipe: choices.get(outputShard)?.recipe }))
            .filter((step): step is { outputShard: string; recipe: Recipe } => step.recipe !== null && step.recipe !== undefined);
          const outputStep = steps.find((step) => step.outputShard === shardId);
          if (!outputStep) continue;
          const consumedPerLap = steps.reduce(
            (sum, step) => sum + step.recipe.inputs.filter((inputId) => inputId === shardId).length * args.data.shards[shardId].fuse_amount,
            0
          );
          const producedPerLap = this.solver.getEffectiveOutputQuantity(outputStep.recipe, crocodileMultiplier);
          const netOutputPerLap = producedPerLap - consumedPerLap;
          if (netOutputPerLap <= COST_TOLERANCE) continue;

          const tree = this.solver.buildRecipeTree(args.data, shardId, choices, [cycle], args.params, [], {
            minCosts: args.baselineMinCosts,
            choices: args.baselineChoices,
          });
          if (tree.method !== "cycle") continue;
          this.solver.assignQuantities(tree, netOutputPerLap, args.data, { total: 0 }, choices, crocodileMultiplier, args.params);
          const cycleQuantities = this.solver.computeCycleQuantities(shardId, steps, netOutputPerLap, args.data, crocodileMultiplier);
          if (!cycleQuantities) continue;
          const laps = cycleQuantities.roundedCrafts / cycleQuantities.stepCount;
          const batchOutput = netOutputPerLap * laps;
          const details = this.buildBatchDetails(
            tree.cycleInputs,
            tree,
            batchOutput,
            args.params,
            args.directRates,
            grossSalePricePerShard
          );
          if (!details || details.batchCost <= 0) continue;

          const fusionCostPerShard = details.batchCost / batchOutput;
          const netSalePricePerShard = grossSalePricePerShard * (1 - BAZAAR_TAX_RATE);
          const profitPerShard = netSalePricePerShard - fusionCostPerShard;
          if (fusionCostPerShard >= directPurchaseCost - COST_TOLERANCE || profitPerShard <= COST_TOLERANCE) continue;

          const result: FusionProfitResult = {
            shardId,
            shard: args.data.shards[shardId],
            kind: "cycle",
            recipe,
            cycleShards: cycle,
            directPurchaseCost,
            fusionCostPerShard,
            grossSalePricePerShard,
            netSalePricePerShard,
            profitPerShard,
            roi: profitPerShard / fusionCostPerShard,
            batchOutput,
            ...details,
            tree,
          };
          const current = bestByOutput.get(shardId);
          if (!current || result.profitPerShard > current.profitPerShard) bestByOutput.set(shardId, result);
        }
      }
    }

    return [...bestByOutput.values()];
  }

  private createCycleCandidateChoices(data: Data, normalChoices: Map<string, RecipeChoice>, minCosts: Map<string, number>): Map<string, RecipeChoice>[] {
    const components = this.findPotentialCycleComponents(data);
    const candidates: Map<string, RecipeChoice>[] = [];

    for (const component of components) {
      const componentSet = new Set(component);
      const internalRecipes = new Map<string, Recipe[]>();
      for (const shardId of component) {
        const recipes = (data.recipes[shardId] || []).filter((recipe) => recipe.inputs.some((input) => componentSet.has(input)));
        if (recipes.length) internalRecipes.set(shardId, recipes);
      }
      if (internalRecipes.size === 0) continue;

      const base = new Map(normalChoices);
      for (const [shardId, recipes] of internalRecipes) {
        base.set(shardId, { recipe: this.cheapestEstimatedRecipe(recipes, data, minCosts) });
      }
      candidates.push(base);

      for (const [shardId, recipes] of internalRecipes) {
        for (const recipe of recipes.slice(0, 3)) {
          const variant = new Map(base);
          variant.set(shardId, { recipe });
          candidates.push(variant);
        }
      }
    }
    return candidates;
  }

  private cheapestEstimatedRecipe(recipes: Recipe[], data: Data, minCosts: Map<string, number>): Recipe {
    return [...recipes].sort((a, b) => {
      const estimate = (recipe: Recipe) =>
        recipe.inputs.reduce((sum, input) => sum + (minCosts.get(input) ?? Infinity) * data.shards[input].fuse_amount, 0) / recipe.outputQuantity;
      return estimate(a) - estimate(b);
    })[0];
  }

  private findPotentialCycleComponents(data: Data): string[][] {
    const graph = new Map<string, Set<string>>();
    for (const [output, recipes] of Object.entries(data.recipes)) {
      const neighbors = graph.get(output) ?? new Set<string>();
      for (const recipe of recipes) {
        for (const input of recipe.inputs) {
          if (data.recipes[input]?.length) neighbors.add(input);
        }
      }
      graph.set(output, neighbors);
    }

    let nextIndex = 0;
    const indices = new Map<string, number>();
    const lowLinks = new Map<string, number>();
    const stack: string[] = [];
    const onStack = new Set<string>();
    const components: string[][] = [];

    const connect = (node: string) => {
      indices.set(node, nextIndex);
      lowLinks.set(node, nextIndex++);
      stack.push(node);
      onStack.add(node);
      for (const neighbor of graph.get(node) ?? []) {
        if (!indices.has(neighbor)) {
          connect(neighbor);
          lowLinks.set(node, Math.min(lowLinks.get(node)!, lowLinks.get(neighbor)!));
        } else if (onStack.has(neighbor)) {
          lowLinks.set(node, Math.min(lowLinks.get(node)!, indices.get(neighbor)!));
        }
      }
      if (lowLinks.get(node) !== indices.get(node)) return;
      const component: string[] = [];
      let member: string;
      do {
        member = stack.pop()!;
        onStack.delete(member);
        component.push(member);
      } while (member !== node);
      const selfLoop = component.length === 1 && graph.get(component[0])?.has(component[0]);
      if (component.length > 1 || selfLoop) components.push(component);
    };

    for (const node of graph.keys()) if (!indices.has(node)) connect(node);
    return components;
  }
}
