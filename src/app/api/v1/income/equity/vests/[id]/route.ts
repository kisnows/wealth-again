import { NextResponse } from "next/server";
import prisma from "@/server/db";

/**
 * PATCH /api/v1/income/equity/vests/:id
 * - 在归属日回填 fairValue、currency（用于计税）。
 * - 入参: { fairValue: number, currency: string }
 */

// 回填归属日 fairValue/currency
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { fairValue, currency } = await req.json();
  if (typeof fairValue !== "number" || !currency) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const updated = await prisma.equityVest.update({ where: { id: params.id }, data: { fairValue, currency } });
  return NextResponse.json(updated);
}
