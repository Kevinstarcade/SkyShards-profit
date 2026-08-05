import type { ProfitCalculationInput, ProfitCalculationOutput } from "../types/profitTypes";

type WorkerMessage = { type: "result"; result: ProfitCalculationOutput } | { type: "error"; message: string };

export const calculateFusionProfitsWithWorker = (
  input: ProfitCalculationInput
): { promise: Promise<ProfitCalculationOutput>; cancel: () => void } => {
  const worker = new Worker(new URL("../workers/profitCalculationWorker.ts", import.meta.url), { type: "module" });
  let rejectPromise: ((reason?: unknown) => void) | null = null;
  let settled = false;

  const promise = new Promise<ProfitCalculationOutput>((resolve, reject) => {
    rejectPromise = reject;
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      if (event.data.type === "result") resolve(event.data.result);
      else reject(new Error(event.data.message));
    };
    worker.onerror = (error) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      reject(error);
    };
    worker.postMessage({ type: "start", input });
  });

  const cancel = () => {
    if (settled) return;
    settled = true;
    worker.terminate();
    rejectPromise?.(new DOMException("Fusion profit calculation cancelled", "AbortError"));
  };

  return { promise, cancel };
};
