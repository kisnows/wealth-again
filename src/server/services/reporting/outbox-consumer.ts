import type { EventOutbox } from "@prisma/client";
import {
  refreshAccountsSummaryDataset,
  refreshIncomeReportingDataset,
} from "@/server/services/reporting/updaters";

export type ReportingConsumeResult = {
  handled: boolean;
  reason?: string;
};

export async function consumeReportingEvent(
  event: EventOutbox,
): Promise<ReportingConsumeResult> {
  const occurredAt = event.occurredAt ?? event.createdAt ?? new Date();
  const payload = event.payload as Record<string, unknown> | null;
  if (!payload || typeof payload !== "object") {
    return { handled: false, reason: "payload_missing" };
  }
  const eventType = String(event.eventType || "").trim();
  if (!eventType) return { handled: false, reason: "event_type_empty" };
  switch (eventType) {
    case "ledger.entry.created":
    case "ledger.valuation.created": {
      const userId = extractUserId(payload);
      if (!userId) return { handled: false, reason: "user_missing" };
      await refreshAccountsSummaryDataset(userId, occurredAt);
      return { handled: true };
    }
    case "income.record.updated":
    case "income.recalc.completed": {
      const userId = extractUserId(payload);
      if (!userId) return { handled: false, reason: "user_missing" };
      await refreshIncomeReportingDataset(userId, occurredAt);
      return { handled: true };
    }
    default:
      return { handled: false, reason: "event_type_unhandled" };
  }
}

function extractUserId(payload: Record<string, unknown>): string | null {
  const userId = payload.userId;
  if (typeof userId === "string" && userId.trim().length > 0) {
    return userId;
  }
  return null;
}
