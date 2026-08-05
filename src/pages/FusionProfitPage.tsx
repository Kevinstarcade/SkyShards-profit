import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { ProfitControls, ProfitResults } from "../components/profit";
import { useCalculatorState } from "../hooks/useCalculatorState";
import { useProfitPreferences } from "../hooks/useProfitPreferences";
import { DataService } from "../services/dataService";
import { calculateFusionProfitsWithWorker } from "../services/profitWorkerService";
import { sortProfitResults } from "../services/profitCalculationService";
import type { ProfitCalculationOutput } from "../types/profitTypes";

const formatSnapshotAge = (timestamp: number | undefined, now: number): string => {
  if (!timestamp) return "Prices not loaded";
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1_000));
  if (seconds < 5) return "Updated just now";
  if (seconds < 60) return `Updated ${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `Updated ${minutes}m ago`;
};

export const FusionProfitPage: React.FC = () => {
  const { form, setForm } = useCalculatorState();
  const { preferences, setPreferences } = useProfitPreferences();
  const [output, setOutput] = useState<ProfitCalculationOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [now, setNow] = useState(Date.now());
  const forceRefresh = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      const cached = DataService.getInstance().getCachedBazaarPriceSnapshot();
      if (!cached || Date.now() - cached.fetchedAt >= 60_000) setRefreshToken((value) => value + 1);
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let cancelWorker: (() => void) | undefined;
    const dataService = DataService.getInstance();

    const calculate = async () => {
      setError(null);
      setLoading(true);
      try {
        const shouldForce = forceRefresh.current;
        forceRefresh.current = false;
        const [fusionJson, defaultRates, snapshot] = await Promise.all([
          dataService.loadFusionJson(),
          dataService.loadDefaultRates(),
          dataService.loadBazaarPriceSnapshot(shouldForce),
        ]);
        if (cancelled) return;
        const job = calculateFusionProfitsWithWorker({
          fusionJson,
          defaultRates,
          snapshot,
          buyMode: preferences.buyMode,
          sellMode: preferences.sellMode,
          crocodileLevel: form.crocodileLevel,
        });
        cancelWorker = job.cancel;
        const result = await job.promise;
        if (!cancelled) setOutput(result);
      } catch (calculationError) {
        if (!cancelled) setError(calculationError instanceof Error ? calculationError.message : String(calculationError));
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    void calculate();
    return () => {
      cancelled = true;
      cancelWorker?.();
    };
  }, [preferences.buyMode, preferences.sellMode, form.crocodileLevel, refreshToken]);

  const normalResults = useMemo(
    () => sortProfitResults(output?.normalResults ?? [], preferences.sortMode),
    [output?.normalResults, preferences.sortMode]
  );
  const cycleResults = useMemo(
    () => sortProfitResults(output?.cycleResults ?? [], preferences.sortMode),
    [output?.cycleResults, preferences.sortMode]
  );

  const refreshPrices = () => {
    forceRefresh.current = true;
    setRefreshing(true);
    setRefreshToken((value) => value + 1);
  };

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="p-2 bg-emerald-500/15 border border-emerald-500/25 rounded-md">
            <TrendingUp className="w-6 h-6 text-emerald-400" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-white">Fusion Profits</h1>
            <p className="text-sm text-slate-400">Find outputs whose cheapest fusion path costs less than buying the shard directly.</p>
          </div>
        </div>
      </header>

      <ProfitControls
        preferences={preferences}
        onPreferencesChange={setPreferences}
        crocodileLevel={form.crocodileLevel}
        onCrocodileLevelChange={(crocodileLevel) => setForm({ ...form, crocodileLevel })}
        onRefresh={refreshPrices}
        refreshing={refreshing}
        updatedLabel={formatSnapshotAge(output?.snapshotFetchedAt, now)}
      />

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-md p-4 flex items-start gap-3 text-red-200">
          <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            <h2 className="font-semibold">Could not calculate fusion profits</h2>
            <p className="text-sm text-red-200/80 mt-1">{error}</p>
          </div>
        </div>
      )}

      {loading && !output ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin" />
        </div>
      ) : output ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="px-2 py-1 rounded bg-slate-800 border border-slate-700">{normalResults.length} normal opportunities</span>
            {cycleResults.length > 0 && <span className="px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300">{cycleResults.length} cyclic opportunities</span>}
          </div>
          <ProfitResults data={output.data} cycleResults={cycleResults} normalResults={normalResults} />
        </>
      ) : null}
    </div>
  );
};
