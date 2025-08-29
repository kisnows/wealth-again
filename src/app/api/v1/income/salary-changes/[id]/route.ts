import { NextResponse } from "next/server";
import prisma from "@/server/db";
import { logAudit } from "@/server/services/audit";
import { getUserFromRequest } from "@/server/utils/auth";

/**
 * DELETE /api/v1/income/salary-changes/:id
 * - 删除指定的工资变更记录
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getUserFromRequest(req as any);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // 检查记录是否存在且属于当前用户
    const record = await prisma.incomeChange.findUnique({
      where: { id },
    });

    if (!record || record.userId !== (user as any).id) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    // 删除记录
    await prisma.incomeChange.delete({
      where: { id },
    });

    // 记录审计日志
    await logAudit("INCOME_SALARY_CHANGE_DELETE", {
      userId: (user as any).id,
      meta: { id, deletedRecord: record },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete salary change error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
