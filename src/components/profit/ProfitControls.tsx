import React from "react";
import { RefreshCw } from "lucide-react";
import type { ProfitPreferences } from "../../types/profitTypes";

interface ProfitControlsProps {
  preferences: ProfitPreferences;
  onPreferencesChange: (preferences: ProfitPreferences) => void;
  crocodileLevel: number;
  onCrocodileLevelChange: (level: number) => void;
  onRefresh: () => void;
  refreshing: boolean;
  updatedLabel: string;
}

const selectClass = "w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-purple-400 focus:outline-none";

export const ProfitControls: React.FC<ProfitControlsProps> = ({
  preferences,
  onPreferencesChange,
  crocodileLevel,
  onCrocodileLevelChange,
  onRefresh,
  refreshing,
  updatedLabel,
}) => (
  <div className="bg-slate-800 border border-slate-600 rounded-md p-4 space-y-4">
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <label className="space-y-1.5">
        <span className="text-xs font-medium text-slate-400">Buy Ingredients</span>
        <select
          className={selectClass}
          value={preferences.buyMode}
          onChange={(event: React.ChangeEvent<HTMLSelectElement>) => onPreferencesChange({ ...preferences, buyMode: event.target.value as ProfitPreferences["buyMode"] })}
        >
          <option value="instant-buy">Instant Buy</option>
          <option value="buy-offer">Buy Offer</option>
        </select>
      </label>
      <label className="space-y-1.5">
        <span className="text-xs font-medium text-slate-400">Sell Output</span>
        <select
          className={selectClass}
          value={preferences.sellMode}
          onChange={(event: React.ChangeEvent<HTMLSelectElement>) => onPreferencesChange({ ...preferences, sellMode: event.target.value as ProfitPreferences["sellMode"] })}
        >
          <option value="instant-sell">Instant Sell</option>
          <option value="sell-offer">Sell Offer</option>
        </select>
      </label>
      <label className="space-y-1.5">
        <span className="text-xs font-medium text-slate-400">Sort Results</span>
        <select
          className={selectClass}
          value={preferences.sortMode}
          onChange={(event: React.ChangeEvent<HTMLSelectElement>) => onPreferencesChange({ ...preferences, sortMode: event.target.value as ProfitPreferences["sortMode"] })}
        >
          <option value="profit">Profit per Shard</option>
          <option value="roi">ROI</option>
        </select>
      </label>
      <label className="space-y-1.5">
        <span className="text-xs font-medium text-slate-400">Crocodile Level</span>
        <input
          className={selectClass}
          type="number"
          min={0}
          max={10}
          step={1}
          value={crocodileLevel}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => onCrocodileLevelChange(Math.min(10, Math.max(0, Number(event.target.value) || 0)))}
        />
      </label>
    </div>
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-slate-700 pt-3">
      <p className="text-xs text-slate-400">Prices use Hypixel quick status. Selling revenue includes the 1.25% Bazaar tax.</p>
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500">{updatedLabel}</span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="px-3 py-2 font-medium rounded-md text-xs transition-colors flex items-center gap-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh Prices
        </button>
      </div>
    </div>
  </div>
);
