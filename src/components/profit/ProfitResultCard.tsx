import React, { useState } from "react";
import { ChevronDown, Repeat2 } from "lucide-react";
import type { Data } from "../../types/types";
import type { FusionProfitResult } from "../../types/profitTypes";
import { formatLargeNumber, getRarityColor, shardIconUrl } from "../../utilities";
import { ProfitDetails } from "./ProfitDetails";

interface ProfitResultCardProps {
  result: FusionProfitResult;
  data: Data;
}

export const ProfitResultCard: React.FC<ProfitResultCardProps> = ({ result, data }) => {
  const [expanded, setExpanded] = useState(false);
  const inputs = result.recipe?.inputs.map((id) => data.shards[id]?.name ?? id).join(" + ");

  return (
    <article className="bg-slate-800 border border-slate-600 rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="w-full p-3 text-left hover:bg-slate-700/30 transition-colors cursor-pointer"
        aria-expanded={expanded}
      >
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <img src={shardIconUrl(result.shard.id)} alt="" className="w-10 h-10 object-contain flex-shrink-0" loading="lazy" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className={`font-semibold truncate ${getRarityColor(result.shard.rarity)}`}>{result.shard.name}</h3>
                {result.kind === "cycle" && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/15 text-amber-300 text-[11px]">
                    <Repeat2 className="w-3 h-3" /> Cycle
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate">{result.kind === "cycle" ? result.cycleShards?.map((id) => data.shards[id]?.name ?? id).join(" → ") : inputs}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:min-w-[560px]">
            <div>
              <p className="text-[11px] text-slate-500">Profit / Shard</p>
              <p className="text-sm font-semibold text-emerald-400">{formatLargeNumber(result.profitPerShard)}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">ROI</p>
              <p className="text-sm font-semibold text-purple-300">{(result.roi * 100).toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Fusion Cost</p>
              <p className="text-sm text-slate-200">{formatLargeNumber(result.fusionCostPerShard)}</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-slate-500">Net Sale</p>
                <p className="text-sm text-slate-200">{formatLargeNumber(result.netSalePricePerShard)}</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </div>
          </div>
        </div>
      </button>
      {expanded && <ProfitDetails result={result} data={data} />}
    </article>
  );
};
