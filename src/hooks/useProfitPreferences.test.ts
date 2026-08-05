import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PROFIT_PREFERENCES, loadProfitPreferences } from "./useProfitPreferences";

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
});

describe("loadProfitPreferences", () => {
  it("uses the agreed defaults", () => {
    expect(loadProfitPreferences()).toEqual(DEFAULT_PROFIT_PREFERENCES);
  });

  it("loads valid saved modes", () => {
    storage.set("skyshards-fusion-profit-preferences", JSON.stringify({ buyMode: "buy-offer", sellMode: "sell-offer", sortMode: "roi" }));
    expect(loadProfitPreferences()).toEqual({ buyMode: "buy-offer", sellMode: "sell-offer", sortMode: "roi" });
  });

  it("falls back when saved values are invalid", () => {
    storage.set("skyshards-fusion-profit-preferences", JSON.stringify({ buyMode: "wrong" }));
    expect(loadProfitPreferences()).toEqual(DEFAULT_PROFIT_PREFERENCES);
  });
});
