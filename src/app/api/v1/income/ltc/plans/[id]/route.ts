import { NextResponse } from "next/server";
import prisma from "@/server/db";
import { logAudit } from "@/server/services/audit";
import { getUserFromRequest } from "@/server/utils/auth";

/**
 * DELETE /api/v1/income/ltc/plans/:id
 * - 删除指定的长期现金计划及其关联的支付记录
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getUserFromRequest(req as any);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // 检查记录是否存在且属于当前用户
    const record = await prisma.longTermCashPlan.findUnique({
      where: { id },
      include: { payouts: true },
    });

    if (!record || record.userId !== (user as any).id) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    // 先删除关联的支付记录
    await prisma.longTermCashPayout.deleteMany({
      where: { planId: id },
    });

    // 再删除计划记录
    await prisma.longTermCashPlan.delete({
      where: { id },
    });

    // 记录审计日志
    await logAudit("INCOME_LTC_PLAN_DELETE", {
      userId: (user as any).id,
      meta: { id, deletedRecord: record },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete LTC plan error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
