import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";
import { logAudit } from "@/server/services/audit";
import { getUserFromRequest } from "@/server/utils/auth";

/**
 * POST /api/v1/accounts/:id/archive
 * - 将账户归档（status=ARCHIVED），写入审计日志。
 * - 入参: none
 * - 返回: 501 TODO（占位），后续返回 { id, status }
 */

// POST /api/v1/accounts/:id/archive 归档账户
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  const user = await getUserFromRequest(req);
  if (!user || typeof user.id !== "string")
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const account = await prisma.account.findUnique({ where: { id } });
  const { id: userId } = user;
  if (!account || account.userId !== userId)
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  const updated = await prisma.account.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });
  await logAudit("ACCOUNT_ARCHIVE", {
    userId,
    meta: { accountId: id },
  });
  return NextResponse.json({ id: updated.id, status: updated.status });
}
