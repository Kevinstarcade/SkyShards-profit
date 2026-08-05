import React from "react";
import { Repeat2, TrendingUp } from "lucide-react";
import type { Data } from "../../types/types";
import type { FusionProfitResult } from "../../types/profitTypes";
import { ProfitResultCard } from "./ProfitResultCard";

interface ProfitResultsProps {
  data: Data;
  cycleResults: FusionProfitResult[];
  normalResults: FusionProfitResult[];
}

const ResultSection: React.FC<{ title: string; description: string; icon: React.ReactNode; results: FusionProfitResult[]; data: Data }> = ({
  title,
  description,
  icon,
  results,
  data,
}) => (
  <section className="space-y-3">
    <div className="flex items-start gap-2">
      <span className="p-1.5 bg-slate-800 border border-slate-600 rounded-md">{icon}</span>
      <div>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="text-sm text-slate-400">{description}</p>
      </div>
    </div>
    <div className="space-y-2">
      {results.map((result) => <ProfitResultCard key={`${result.kind}-${result.shardId}`} result={result} data={data} />)}
    </div>
  </section>
);

export const ProfitResults: React.FC<ProfitResultsProps> = ({ data, cycleResults, normalResults }) => (
  <div className="space-y-7">
    {cycleResults.length > 0 && (
      <ResultSection
        title="Cyclic Fusions"
        description="Profitable loops are separated because their seed and fodder accounting differs from a normal fusion tree."
        icon={<Repeat2 className="w-5 h-5 text-amber-400" />}
        results={cycleResults}
        data={data}
      />
    )}
    {normalResults.length > 0 ? (
      <ResultSection
        title="Profitable Fusions"
        description="Only shards whose solver-selected fusion route beats direct purchase and remains profitable after tax are included."
        icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
        results={normalResults}
        data={data}
      />
    ) : cycleResults.length === 0 ? (
      <div className="bg-slate-800 border border-slate-600 rounded-md p-8 text-center">
        <TrendingUp className="w-8 h-8 text-slate-500 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-white">No profitable fusions found</h2>
        <p className="text-sm text-slate-400 mt-1">Try another buy/sell combination or refresh the Bazaar snapshot.</p>
      </div>
    ) : null}
  </div>
);
