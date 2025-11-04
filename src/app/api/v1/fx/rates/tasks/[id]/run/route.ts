import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { executeFxRateUpdateTaskNow } from "@/server/services/fx/update";
import { getUserFromRequest } from "@/server/utils/auth";

type RouteContext = {
  params: { id: string };
};

export async function POST(req: NextRequest, context: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const taskId = params.id;
  const result = await executeFxRateUpdateTaskNow(taskId, {
    triggeredBy: user.id,
  });

  switch (result.status) {
    case "not_found":
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    case "already_running":
      return NextResponse.json({
        status: result.status,
        message: "任务正在执行中，请稍后刷新查看结果。",
      });
    case "already_completed":
      return NextResponse.json({
        status: result.status,
        processedAt: result.processedAt
          ? result.processedAt.toISOString()
          : null,
        message: "任务已完成，如需重新执行可创建新的补齐任务。",
      });
    case "conflict":
      return NextResponse.json({
        status: result.status,
        message: "任务状态已变更，请刷新列表后重试。",
      });
    case "failed":
      return NextResponse.json(
        { error: result.error, status: result.status },
        { status: 500 },
      );
    case "completed":
      return NextResponse.json({
        status: result.status,
        inserted: result.inserted,
        message: "已立即执行并写入当周汇率。",
      });
    default:
      return NextResponse.json(
        { error: "unexpected_status", status: result.status },
        { status: 500 },
      );
  }
}
