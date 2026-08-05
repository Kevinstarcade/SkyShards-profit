import React, { useState } from "react";
import { BarChart3, Coins, Hammer, Percent, ReceiptText, TrendingUp } from "lucide-react";
import type { Data } from "../../types/types";
import type { FusionProfitResult } from "../../types/profitTypes";
import { formatLargeNumber } from "../../utilities";
import { MaterialItem, SummaryCard } from "../ui";
import { RecipeTreeNode } from "../tree";

interface ProfitDetailsProps {
  result: FusionProfitResult;
  data: Data;
}

export const ProfitDetails: React.FC<ProfitDetailsProps> = ({ result, data }) => {
  const [expandedStates, setExpandedStates] = useState<Map<string, boolean>>(() => new Map([["root", true]]));
  const toggleNode = (nodeId: string) => {
    setExpandedStates((current) => {
      const next = new Map(current);
      next.set(nodeId, !(next.get(nodeId) ?? true));
      return next;
    });
  };

  return (
    <div className="space-y-3 border-t border-slate-600 p-3">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <SummaryCard icon={TrendingUp} iconColor="text-emerald-400" label="Profit per Shard" value={formatLargeNumber(result.profitPerShard)} />
        <SummaryCard icon={Coins} iconColor="text-yellow-400" label="Fusion Cost per Shard" value={formatLargeNumber(result.fusionCostPerShard)} />
        <SummaryCard icon={Hammer} iconColor="text-orange-400" label="Batch Cost" value={formatLargeNumber(result.batchCost)} />
        <SummaryCard icon={ReceiptText} iconColor="text-blue-400" label="Sale Revenue" value={formatLargeNumber(result.saleRevenue)} />
        <SummaryCard icon={BarChart3} iconColor="text-green-400" label="Net Profit" value={formatLargeNumber(result.netProfit)} />
        <SummaryCard icon={Percent} iconColor="text-purple-400" label="ROI" value={`${(result.roi * 100).toFixed(1)}%`} />
      </div>

      <div className="bg-slate-800 border border-slate-600 rounded-md p-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="p-1 bg-slate-700 rounded-md"><Hammer className="w-5 h-5 text-blue-400" /></span>
            Total Materials
          </h3>
          <span className="text-sm text-slate-400">
            Total Ingredients Cost <span className="font-medium text-slate-200">{formatLargeNumber(result.batchCost)}</span>
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {result.materials.map((material) => (
            <MaterialItem key={material.shardId} shard={data.shards[material.shardId]} quantity={material.quantity} ironManView={false} />
          ))}
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-600 rounded-md p-3">
        <div className="flex items-center gap-2 mb-3">
          <span className="p-1 bg-slate-700 rounded-md"><BarChart3 className="w-5 h-5 text-purple-400" /></span>
          <h3 className="text-lg font-semibold text-white">Fusion Tree</h3>
        </div>
        <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
          <div className="min-w-[810px]">
            <RecipeTreeNode
              tree={result.tree}
              data={data}
              isTopLevel
              totalShardsProduced={result.batchOutput}
              nodeId="root"
              expandedStates={expandedStates}
              onToggle={toggleNode}
              ironManView={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
