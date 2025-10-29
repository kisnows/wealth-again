import { type NextRequest, NextResponse } from "next/server";
import {
  listIncomeRecalcTasks,
  processDueIncomeRecalcTasks,
} from "@/server/services/income-tax/income";
import { getUserFromRequest } from "@/server/utils/auth";

/**
 * GET /api/v1/income/recalc/tasks
 * - 返回当前用户的回算任务列表，并尝试处理到期任务。
 */

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await processDueIncomeRecalcTasks();
  const tasks = await listIncomeRecalcTasks(user.id);
  return NextResponse.json({ items: tasks });
}
