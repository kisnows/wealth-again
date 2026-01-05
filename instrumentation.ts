declare global {
  // eslint-disable-next-line no-var
  var __wealthWorkerStarted: boolean | undefined;
  // eslint-disable-next-line no-var
  var __wealthWorkerStopper: (() => void) | undefined;
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") {
    return;
  }
  if (process.env.NODE_ENV === "test") {
    return;
  }
  if (process.env.DISABLE_BACKGROUND_WORKER === "1") {
    return;
  }
  const globalScope = globalThis as typeof globalThis & {
    __wealthWorkerStarted?: boolean;
    __wealthWorkerStopper?: () => void;
  };
  if (globalScope.__wealthWorkerStarted) {
    return;
  }
  try {
    const { startLocalWorker } = await import(
      "@/server/services/jobs/local-worker"
    );
    const stop = startLocalWorker({ logger: console });
    globalScope.__wealthWorkerStarted = true;
    globalScope.__wealthWorkerStopper = stop;
    if (process.env.NODE_ENV !== "production") {
      console.info("[worker] auto-started via instrumentation");
    }
  } catch (error) {
    globalScope.__wealthWorkerStarted = true;
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(
      `[worker] failed to start via instrumentation: ${message}`
    );
    console.error(
      "[worker] Tip: run `pnpm rebuild better-sqlite3` or set DISABLE_BACKGROUND_WORKER=1"
    );
    if (process.env.NODE_ENV === "production") {
      throw error;
    }
  }
}

export {};
