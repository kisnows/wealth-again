import { NextResponse } from "next/server";
import db from "@/server/db";
import { incomeChanges } from "@/server/db/schema";
import { logAudit } from "@/server/services/audit";
import { getUserFromRequest } from "@/server/utils/auth";
import { eq } from "drizzle-orm";

/**
 * DELETE /api/v1/income-tax/salary-changes/:id
 * - 删除指定的工资变更记录
 */
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  const user = await getUserFromRequest(req);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // 检查记录是否存在且属于当前用户
    const [record] = await db
      .select()
      .from(incomeChanges)
      .where(eq(incomeChanges.id, id))
      .limit(1);

    if (!record || record.userId !== user.id) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    // 删除记录
    await db.delete(incomeChanges).where(eq(incomeChanges.id, id));

    // 记录审计日志
    await logAudit("INCOME_SALARY_CHANGE_DELETE", {
      userId: user.id,
      meta: { id, deletedRecord: record },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete salary change error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
