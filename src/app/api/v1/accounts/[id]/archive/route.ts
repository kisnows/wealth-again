import { NextResponse } from "next/server";
import prisma from "@/server/db";

/**
 * POST /api/v1/accounts/:id/archive
 * - 将账户归档（status=ARCHIVED），写入审计日志。
 * - 入参: none
 * - 返回: 501 TODO（占位），后续返回 { id, status }
 */

// POST /api/v1/accounts/:id/archive 归档账户
export async function POST(_: Request, { params }: { params: { id: string } }) {
  const updated = await prisma.account.update({ where: { id: params.id }, data: { status: "ARCHIVED" } });
  // TODO: 写审计日志
  return NextResponse.json({ id: updated.id, status: updated.status });
}
