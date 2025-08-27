import { NextResponse } from "next/server";
import prisma from "@/server/db";
import { getUserFromRequest } from "@/server/utils/auth";

/**
 * POST /api/v1/accounts/:id/archive
 * - 将账户归档（status=ARCHIVED），写入审计日志。
 * - 入参: none
 * - 返回: 501 TODO（占位），后续返回 { id, status }
 */

// POST /api/v1/accounts/:id/archive 归档账户
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req as any);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const account = await prisma.account.findUnique({ where: { id: params.id } });
  if (!account || account.userId !== (user as any).id) return NextResponse.json({ error: "Not Found" }, { status: 404 });
  const updated = await prisma.account.update({ where: { id: params.id }, data: { status: "ARCHIVED" } });
  return NextResponse.json({ id: updated.id, status: updated.status });
}
