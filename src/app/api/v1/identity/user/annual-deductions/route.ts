import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";
import { getUserFromRequest } from "@/server/utils/auth";

/**
 * GET /api/v1/identity/user/annual-deductions
 * - 返回当前用户（或 admin 指定 userId）的年度专项附加扣除记录。
 */
export async function GET(req: NextRequest) {
  const viewer = await getUserFromRequest(req);
  if (!viewer)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const requestedUserId = searchParams.get("userId");
  const userId = requestedUserId ?? viewer.id;

  const items = await prisma.userAnnualDeduction.findMany({
    where: { userId },
    orderBy: { taxYear: "desc" },
  });

  return NextResponse.json({
    items: items.map((item) => ({
      id: item.id,
      taxYear: item.taxYear,
      annualAmount: Number(item.annualAmount || 0),
      allocationRule: item.allocationRule,
      note: item.note,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      userId: item.userId,
    })),
  });
}
