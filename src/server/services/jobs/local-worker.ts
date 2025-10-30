#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import prisma from "@/server/db";
import { processDueIncomeRecalcTasks } from "@/server/services/income-tax/income";
import {
  fetchPendingOutboxEvents,
  markOutboxEventDelivered,
  markOutboxEventFailed,
} from "@/server/services/outbox";
import { consumeReportingEvent } from "@/server/services/reporting/outbox-consumer";

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
  const { batchSize = DEFAULT_BATCH_SIZE, logger = console } = options;
  const incomeResult = await processDueIncomeRecalcTasks(batchSize);
  if (incomeResult.processed > 0) {
    logger.info?.(
      `[worker] processed income recalc tasks: ${incomeResult.processed}`,
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
          JSON.stringify({ id: event.id, reason: result.reason ?? "no_consumer" }),
        );
      }
      await markOutboxEventDelivered(prisma, event.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "unexpected error";
      logger.error?.(`[outbox] failed ${event.eventType}: ${message}`);
      await markOutboxEventFailed(prisma, event.id, message);
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
