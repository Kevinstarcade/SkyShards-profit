/// <reference lib="webworker" />

import { ProfitCalculationService } from "../services/profitCalculationService";
import type { ProfitCalculationInput } from "../types/profitTypes";

type StartMessage = { type: "start"; input: ProfitCalculationInput };

self.onmessage = (event: MessageEvent<StartMessage>) => {
  if (event.data?.type !== "start") return;
  try {
    const result = new ProfitCalculationService().calculate(event.data.input);
    self.postMessage({ type: "result", result });
  } catch (error) {
    self.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) });
  }
};

export {};
