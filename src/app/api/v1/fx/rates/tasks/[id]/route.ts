import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import db from "@/server/db";
import { fxRateUpdateLogs, fxRateUpdateTasks } from "@/server/db/schema";
import { getUserFromRequest } from "@/server/utils/auth";
import { asc, eq } from "drizzle-orm";

type RouteContext = {
  params: { id: string };
};

export async function GET(req: NextRequest, context: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const params = await context.params;
  const taskId = params.id;
  const [task] = await db
    .select()
    .from(fxRateUpdateTasks)
    .where(eq(fxRateUpdateTasks.id, taskId))
    .limit(1);
  if (!task) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const logRows = await db
    .select()
    .from(fxRateUpdateLogs)
    .where(eq(fxRateUpdateLogs.taskId, taskId))
    .orderBy(asc(fxRateUpdateLogs.weekStart));
  const logs = logRows.map((log) => ({
    id: log.id,
    weekStart: log.weekStart.toISOString(),
    weekEnd: log.weekEnd.toISOString(),
    status: log.status,
    rate: log.rate == null ? null : Number(log.rate),
    attempts: log.attempts,
    lastError: log.lastError ?? null,
    startedAt: log.startedAt ? log.startedAt.toISOString() : null,
    completedAt: log.completedAt ? log.completedAt.toISOString() : null,
    createdAt: log.createdAt.toISOString(),
    updatedAt: log.updatedAt.toISOString(),
  }));
  const summary = logs.reduce(
    (acc, log) => {
      acc.total += 1;
      switch (log.status) {
        case "COMPLETED":
          acc.completed += 1;
          break;
        case "RUNNING":
          acc.running += 1;
          break;
        case "FAILED":
          acc.failed += 1;
          break;
        case "SKIPPED":
          acc.skipped += 1;
          break;
        default:
          acc.pending += 1;
          break;
      }
      return acc;
    },
    { total: 0, completed: 0, running: 0, failed: 0, skipped: 0, pending: 0 },
  );

  return NextResponse.json({
    id: task.id,
    base: task.base,
    quote: task.quote,
    startDate: task.startDate.toISOString(),
    endDate: task.endDate.toISOString(),
    status: task.status,
    scheduledFor: task.scheduledFor.toISOString(),
    processedAt: task.processedAt ? task.processedAt.toISOString() : null,
    attempts: task.attempts,
    lastError: task.lastError ?? null,
    triggeredBy: task.triggeredBy ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    logs,
    summary,
  });
}
