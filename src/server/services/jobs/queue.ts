import type { IncomeRecalcTask, Prisma } from "@prisma/client";
import prisma from "@/server/db";
import { writeOutboxEvent } from "@/server/services/outbox";

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

type PrismaClientOrTx = Prisma.TransactionClient | typeof prisma;

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

  return prisma.$transaction(async (tx) => {
    let targetTask: IncomeRecalcTask | null = null;
    if (userId) {
      const existing = await tx.incomeRecalcTask.findFirst({
        where: { userId, taxYear, status: "PENDING" },
        orderBy: { scheduledFor: "asc" },
      });
      if (existing) {
        targetTask = await tx.incomeRecalcTask.update({
          where: { id: existing.id },
          data: {
            startMonth: Math.min(existing.startMonth, normalizedStart),
            endMonth: Math.max(existing.endMonth, normalizedEnd),
            cityId: cityId ?? existing.cityId,
            scheduledFor,
            triggeredBy: triggeredBy ?? existing.triggeredBy,
            updatedAt: now,
          },
        });
      }
    }
    if (!targetTask) {
      targetTask = await tx.incomeRecalcTask.create({
        data: {
          userId: userId ?? null,
          taxYear,
          startMonth: normalizedStart,
          endMonth: normalizedEnd,
          cityId: cityId ?? null,
          status: "PENDING",
          scheduledFor,
          attempts: 0,
          triggeredBy: triggeredBy ?? null,
        },
      });
    }
    await writeOutboxEvent(tx, {
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
  const tasks = await prisma.incomeRecalcTask.findMany({
    where: {
      status: "PENDING",
      scheduledFor: { lte: new Date() },
    },
    orderBy: { scheduledFor: "asc" },
    take: limit,
  });
  return tasks.map((task) => ({ ...task, type: "income.recalc" }));
}

export async function markIncomeRecalcRunning(
  task: IncomeRecalcTask,
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.incomeRecalcTask.updateMany({
      where: { id: task.id, status: "PENDING" },
      data: {
        status: "RUNNING",
        attempts: task.attempts + 1,
        updatedAt: new Date(),
      },
    });
    if (!claimed.count) {
      return false;
    }
    await writeOutboxEvent(tx, {
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
  await prisma.$transaction(async (tx) => {
    await tx.incomeRecalcTask.update({
      where: { id: task.id },
      data: {
        status: "COMPLETED",
        processedAt,
        lastError: null,
        updatedAt: processedAt,
      },
    });
    await writeOutboxEvent(tx, {
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
  await prisma.$transaction(async (tx) => {
    await tx.incomeRecalcTask.update({
      where: { id: task.id },
      data: {
        status: "FAILED",
        lastError: error,
        scheduledFor: retryAt,
        updatedAt: new Date(),
      },
    });
    await writeOutboxEvent(tx, {
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
  client: PrismaClientOrTx,
  userId: string,
  taxYear: number,
): Promise<void> {
  await client.incomeRecalcTask.updateMany({
    where: {
      userId,
      taxYear,
      status: { in: ["PENDING", "RUNNING", "FAILED"] },
    },
    data: {
      status: "COMPLETED",
      processedAt: new Date(),
      lastError: null,
      updatedAt: new Date(),
    },
  });
}
