import type { IncomeRecalcTask } from "@/server/db/types";
import db from "@/server/db";
import { incomeRecalcTasks } from "@/server/db/schema";
import { and, asc, eq, inArray, lte } from "drizzle-orm";
import { writeOutboxEventSync } from "@/server/services/outbox";

export type IncomeRecalcJob = IncomeRecalcTask & { type: "income.recalc" };

export type EnqueueIncomeRecalcOptions = {
  userId?: string;
  taxYear: number;
  startMonth?: number;
  endMonth?: number;
  cityId?: string;
  triggeredBy?: string;
  delayMs?: number;
};

type DbClient = typeof db;

function clampMonth(value: number) {
  return Math.max(1, Math.min(12, value));
}

export async function enqueueIncomeRecalcTask(
  options: EnqueueIncomeRecalcOptions,
): Promise<IncomeRecalcTask> {
  const {
    userId,
    taxYear,
    startMonth = 1,
    endMonth = 12,
    cityId,
    triggeredBy,
    delayMs = 0,
  } = options;
  const now = new Date();
  const scheduledFor = new Date(now.getTime() + Math.max(delayMs, 0));
  const normalizedStart = clampMonth(startMonth);
  const normalizedEnd = Math.max(normalizedStart, clampMonth(endMonth));

  return db.transaction((tx) => {
    let targetTask: IncomeRecalcTask | null = null;
    if (userId) {
      const existing = tx
        .select()
        .from(incomeRecalcTasks)
        .where(
          and(
            eq(incomeRecalcTasks.userId, userId),
            eq(incomeRecalcTasks.taxYear, taxYear),
            eq(incomeRecalcTasks.status, "PENDING"),
          ),
        )
        .orderBy(asc(incomeRecalcTasks.scheduledFor))
        .limit(1)
        .get();
      if (existing) {
        const updated = tx
          .update(incomeRecalcTasks)
          .set({
            startMonth: Math.min(existing.startMonth, normalizedStart),
            endMonth: Math.max(existing.endMonth, normalizedEnd),
            cityId: cityId ?? existing.cityId,
            scheduledFor,
            triggeredBy: triggeredBy ?? existing.triggeredBy,
            updatedAt: now,
          })
          .where(eq(incomeRecalcTasks.id, existing.id))
          .returning()
          .get();
        targetTask = updated ?? null;
      }
    }
    if (!targetTask) {
      const created = tx
        .insert(incomeRecalcTasks)
        .values({
          userId: userId ?? null,
          taxYear,
          startMonth: normalizedStart,
          endMonth: normalizedEnd,
          cityId: cityId ?? null,
          status: "PENDING",
          scheduledFor,
          attempts: 0,
          triggeredBy: triggeredBy ?? null,
        })
        .returning()
        .get();
      targetTask = created;
    }
    if (!targetTask) {
      throw new Error("income_recalc_task_create_failed");
    }
    writeOutboxEventSync(tx, {
      eventType: "income.recalc.requested",
      payload: {
        taskId: targetTask.id,
        userId: targetTask.userId,
        taxYear: targetTask.taxYear,
        startMonth: targetTask.startMonth,
        endMonth: targetTask.endMonth,
        cityId: targetTask.cityId,
        triggeredBy: targetTask.triggeredBy ?? null,
        scheduledFor: scheduledFor.toISOString(),
      },
    });
    return targetTask;
  });
}

export async function fetchPendingIncomeRecalcTasks(limit = 5): Promise<IncomeRecalcJob[]> {
  const tasks = await db
    .select()
    .from(incomeRecalcTasks)
    .where(
      and(
        eq(incomeRecalcTasks.status, "PENDING"),
        lte(incomeRecalcTasks.scheduledFor, new Date()),
      ),
    )
    .orderBy(asc(incomeRecalcTasks.scheduledFor))
    .limit(limit);
  return tasks.map((task) => ({ ...task, type: "income.recalc" }));
}

export async function markIncomeRecalcRunning(
  task: IncomeRecalcTask,
): Promise<boolean> {
  return db.transaction((tx) => {
    const claimed = tx
      .update(incomeRecalcTasks)
      .set({
        status: "RUNNING",
        attempts: task.attempts + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(incomeRecalcTasks.id, task.id),
          eq(incomeRecalcTasks.status, "PENDING"),
        ),
      )
      .run();
    if (!claimed.changes) {
      return false;
    }
    writeOutboxEventSync(tx, {
      eventType: "income.recalc.started",
      payload: {
        taskId: task.id,
        userId: task.userId,
        taxYear: task.taxYear,
        startMonth: task.startMonth,
        endMonth: task.endMonth,
        cityId: task.cityId,
        attempts: task.attempts + 1,
      },
    });
    return true;
  });
}

export async function markIncomeRecalcCompleted(
  task: IncomeRecalcTask,
  updatedCount: number,
): Promise<void> {
  const processedAt = new Date();
  db.transaction((tx) => {
    tx
      .update(incomeRecalcTasks)
      .set({
        status: "COMPLETED",
        processedAt,
        lastError: null,
        updatedAt: processedAt,
      })
      .where(eq(incomeRecalcTasks.id, task.id))
      .run();
    writeOutboxEventSync(tx, {
      eventType: "income.recalc.completed",
      payload: {
        taskId: task.id,
        userId: task.userId,
        taxYear: task.taxYear,
        startMonth: task.startMonth,
        endMonth: task.endMonth,
        cityId: task.cityId,
        updatedRecords: updatedCount,
        processedAt: processedAt.toISOString(),
      },
    });
  });
}

export async function markIncomeRecalcFailed(
  task: IncomeRecalcTask,
  error: string,
  retryAt: Date,
): Promise<void> {
  db.transaction((tx) => {
    tx
      .update(incomeRecalcTasks)
      .set({
        status: "FAILED",
        lastError: error,
        scheduledFor: retryAt,
        updatedAt: new Date(),
      })
      .where(eq(incomeRecalcTasks.id, task.id))
      .run();
    writeOutboxEventSync(tx, {
      eventType: "income.recalc.failed",
      payload: {
        taskId: task.id,
        userId: task.userId,
        taxYear: task.taxYear,
        startMonth: task.startMonth,
        endMonth: task.endMonth,
        cityId: task.cityId,
        error,
        retryAt: retryAt.toISOString(),
      },
    });
  });
}

export async function releaseIncomeRecalcTasks(
  client: DbClient,
  userId: string,
  taxYear: number,
): Promise<void> {
  await client
    .update(incomeRecalcTasks)
    .set({
      status: "COMPLETED",
      processedAt: new Date(),
      lastError: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(incomeRecalcTasks.userId, userId),
        eq(incomeRecalcTasks.taxYear, taxYear),
        inArray(incomeRecalcTasks.status, ["PENDING", "RUNNING", "FAILED"]),
      ),
    );
}
