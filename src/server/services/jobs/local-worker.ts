#!/usr/bin/env node
import { fileURLToPath } from "node:url";
type WorkerDeps = {
  db: typeof import("@/server/db").default;
  processDueIncomeRecalcTasks: typeof import("@/server/services/income-tax/income").processDueIncomeRecalcTasks;
  fetchPendingOutboxEvents: typeof import("@/server/services/outbox").fetchPendingOutboxEvents;
  markOutboxEventDelivered: typeof import("@/server/services/outbox").markOutboxEventDelivered;
  markOutboxEventFailed: typeof import("@/server/services/outbox").markOutboxEventFailed;
  consumeReportingEvent: typeof import("@/server/services/reporting/outbox-consumer").consumeReportingEvent;
  ensureWeeklyFxCoverage: typeof import("@/server/services/fx/update").ensureWeeklyFxCoverage;
  processDueFxRateUpdateTasks: typeof import("@/server/services/fx/update").processDueFxRateUpdateTasks;
};

async function loadWorkerDeps(): Promise<WorkerDeps> {
  const [dbMod, incomeMod, outboxMod, reportingMod, fxUpdateMod] =
    await Promise.all([
      import("@/server/db"),
      import("@/server/services/income-tax/income"),
      import("@/server/services/outbox"),
      import("@/server/services/reporting/outbox-consumer"),
      import("@/server/services/fx/update"),
    ]);

  return {
    db: dbMod.default,
    processDueIncomeRecalcTasks: incomeMod.processDueIncomeRecalcTasks,
    fetchPendingOutboxEvents: outboxMod.fetchPendingOutboxEvents,
    markOutboxEventDelivered: outboxMod.markOutboxEventDelivered,
    markOutboxEventFailed: outboxMod.markOutboxEventFailed,
    consumeReportingEvent: reportingMod.consumeReportingEvent,
    ensureWeeklyFxCoverage: fxUpdateMod.ensureWeeklyFxCoverage,
    processDueFxRateUpdateTasks: fxUpdateMod.processDueFxRateUpdateTasks,
  };
}

export type WorkerOptions = {
  intervalMs?: number;
  batchSize?: number;
  logger?: Pick<Console, "info" | "error">;
};

const DEFAULT_INTERVAL_MS = 5_000;
const DEFAULT_BATCH_SIZE = 20;

export async function runWorkerIteration(
  options: WorkerOptions = {},
): Promise<void> {
  const {
    db,
    consumeReportingEvent,
    ensureWeeklyFxCoverage,
    fetchPendingOutboxEvents,
    markOutboxEventDelivered,
    markOutboxEventFailed,
    processDueFxRateUpdateTasks,
    processDueIncomeRecalcTasks,
  } = await loadWorkerDeps();
  const { batchSize = DEFAULT_BATCH_SIZE, logger = console } = options;
  const scheduled = await ensureWeeklyFxCoverage();
  if (scheduled > 0) {
    logger.info?.(
      `[worker] scheduled fx update tasks`,
      JSON.stringify({ scheduled }),
    );
  }
  const incomeResult = await processDueIncomeRecalcTasks(batchSize);
  if (incomeResult.processed > 0) {
    logger.info?.(
      `[worker] processed income recalc tasks: ${incomeResult.processed}`,
    );
  }
  const fxResult = await processDueFxRateUpdateTasks(
    Math.max(1, Math.floor(batchSize / 2)),
  );
  if (fxResult.processed > 0) {
    logger.info?.(
      `[worker] processed fx update tasks`,
      JSON.stringify(fxResult.results),
    );
  }
  const events = await fetchPendingOutboxEvents(batchSize);
  for (const event of events) {
    try {
      const result = await consumeReportingEvent(event);
      if (!result.handled && result.reason === "user_missing") {
        throw new Error("reporting_consumer_user_missing");
      }
      if (result.handled) {
        logger.info?.(
          `[outbox] consumed ${event.eventType}`,
          JSON.stringify({ id: event.id, reason: result.reason ?? "handled" }),
        );
      } else {
        logger.info?.(
          `[outbox] skipped ${event.eventType}`,
          JSON.stringify({
            id: event.id,
            reason: result.reason ?? "no_consumer",
          }),
        );
      }
      await markOutboxEventDelivered(db, event.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "unexpected error";
      logger.error?.(`[outbox] failed ${event.eventType}: ${message}`);
      await markOutboxEventFailed(db, event.id, message);
    }
  }
}

export function startLocalWorker(options: WorkerOptions = {}) {
  const { intervalMs = DEFAULT_INTERVAL_MS, logger = console } = options;
  let stopped = false;

  async function tick() {
    if (stopped) return;
    try {
      await runWorkerIteration(options);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "unexpected error";
      logger.error?.(`[worker] iteration failed: ${message}`);
    } finally {
      if (!stopped) {
        setTimeout(tick, intervalMs);
      }
    }
  }

  tick();

  return () => {
    stopped = true;
  };
}

const isDirectRun = fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectRun) {
  startLocalWorker();
}
