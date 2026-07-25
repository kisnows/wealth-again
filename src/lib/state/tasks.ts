"use client";

import { create } from "zustand";
import type { IncomeRecalcTask } from "@/lib/api/income";

export type BackgroundTaskSummary = {
  id: string;
  type: string;
  status: string;
  queuedAt: string;
  processedAt?: string | null;
  attempts?: number;
  meta?: Record<string, unknown> | null;
};

export type OutboxEventSummary = {
  id: string;
  eventType: string;
  status: string;
  payload?: Record<string, unknown> | null;
  availableAt?: string | null;
  publishedAt?: string | null;
};

export type AuditLogEntry = {
  id: string;
  action: string;
  actorId: string;
  occurredAt: string;
  meta?: Record<string, unknown> | null;
};

type TaskCenterState = {
  recalcTasks: IncomeRecalcTask[];
  exportTasks: BackgroundTaskSummary[];
  outboxEvents: OutboxEventSummary[];
  auditLogs: AuditLogEntry[];
  lastSyncedAt: string | null;
  setRecalcTasks: (tasks: IncomeRecalcTask[]) => void;
  setExportTasks: (tasks: BackgroundTaskSummary[]) => void;
  setOutboxEvents: (events: OutboxEventSummary[]) => void;
  setAuditLogs: (logs: AuditLogEntry[]) => void;
  setLastSyncedAt: (value: string | null) => void;
  reset: () => void;
};

export const useTaskCenterStore = create<TaskCenterState>((set) => ({
  recalcTasks: [],
  exportTasks: [],
  outboxEvents: [],
  auditLogs: [],
  lastSyncedAt: null,
  setRecalcTasks: (recalcTasks) => set({ recalcTasks }),
  setExportTasks: (exportTasks) => set({ exportTasks }),
  setOutboxEvents: (outboxEvents) => set({ outboxEvents }),
  setAuditLogs: (auditLogs) => set({ auditLogs }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
  reset: () =>
    set({
      recalcTasks: [],
      exportTasks: [],
      outboxEvents: [],
      auditLogs: [],
      lastSyncedAt: null,
    }),
}));
