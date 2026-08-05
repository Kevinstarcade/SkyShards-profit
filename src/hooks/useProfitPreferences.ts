import { useEffect, useState } from "react";
import type { ProfitPreferences } from "../types/profitTypes";

const STORAGE_KEY = "skyshards-fusion-profit-preferences";

export const DEFAULT_PROFIT_PREFERENCES: ProfitPreferences = {
  buyMode: "instant-buy",
  sellMode: "instant-sell",
  sortMode: "profit",
};

const isPreferences = (value: unknown): value is ProfitPreferences => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ProfitPreferences>;
  return (
    (candidate.buyMode === "instant-buy" || candidate.buyMode === "buy-offer") &&
    (candidate.sellMode === "instant-sell" || candidate.sellMode === "sell-offer") &&
    (candidate.sortMode === "profit" || candidate.sortMode === "roi")
  );
};

export const loadProfitPreferences = (): ProfitPreferences => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFIT_PREFERENCES;
    const parsed: unknown = JSON.parse(raw);
    return isPreferences(parsed) ? parsed : DEFAULT_PROFIT_PREFERENCES;
  } catch {
    return DEFAULT_PROFIT_PREFERENCES;
  }
};

export const useProfitPreferences = () => {
  const [preferences, setPreferences] = useState<ProfitPreferences>(loadProfitPreferences);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Browsers may block localStorage. The feature still works for this session.
    }
  }, [preferences]);

  return { preferences, setPreferences };
};
