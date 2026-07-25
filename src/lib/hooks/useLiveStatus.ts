"use client";

import { useEffect } from "react";
import useSWR from "swr";
import {
  INCOME_RECALC_TASKS_KEY,
  type IncomeRecalcTask,
} from "@/lib/api/income";
import { getJson } from "@/lib/utils/fetcher";
import { useUserPrefsStore } from "@/lib/state/identity";
import { useTaskCenterStore } from "@/lib/state/tasks";

type LiveStatusOptions = {
  refreshInterval?: number;
  enabled?: boolean;
};

type RecalcResponse = {
  items: IncomeRecalcTask[];
};

export function useLiveStatus(options?: LiveStatusOptions) {
  const { refreshInterval = 60_000, enabled = true } = options ?? {};
  const setPendingTasks = useUserPrefsStore((state) => state.setPendingTasks);
  const setLastDataSyncAt = useUserPrefsStore(
    (state) => state.setLastDataSyncAt,
  );
  const setRecalcTasks = useTaskCenterStore((state) => state.setRecalcTasks);
  const setLastSyncedAt = useTaskCenterStore(
    (state) => state.setLastSyncedAt,
  );

  const swr = useSWR<RecalcResponse>(
    enabled ? ["live-status", INCOME_RECALC_TASKS_KEY] : null,
    async () => getJson<RecalcResponse>(INCOME_RECALC_TASKS_KEY),
    {
      refreshInterval,
    },
  );

  useEffect(() => {
    if (!swr.data) return;
    const tasks = swr.data.items ?? [];
    const pending = tasks.filter((task) =>
      task.status === "PENDING" || task.status === "RUNNING",
    ).length;
    const timestamp = new Date().toISOString();
    setPendingTasks(pending);
    setLastDataSyncAt(timestamp);
    setRecalcTasks(tasks);
    setLastSyncedAt(timestamp);
  }, [swr.data, setPendingTasks, setLastDataSyncAt, setRecalcTasks, setLastSyncedAt]);

  return swr;
}
