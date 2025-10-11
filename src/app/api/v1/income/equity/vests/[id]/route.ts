import { NextResponse } from "next/server";
import prisma from "@/server/db";
import { getUserFromRequest } from "@/server/utils/auth";

/**
 * PATCH /api/v1/income/equity/vests/:id
 * - 在归属日回填 fairValue、currency（用于计税）。
 * - 入参: { fairValue: number, currency: string }
 */

// 回填归属日 fairValue/currency
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getUserFromRequest(req as any);
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { fairValue, currency } = await (req as any).json();
  if (typeof fairValue !== "number" || !currency) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const vest = await prisma.equityVest.findUnique({
    where: { id },
    include: { grant: true },
  });
  if (!vest || vest.grant.userId !== (user as any).id)
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  const updated = await prisma.equityVest.update({
    where: { id },
    data: { fairValue, currency },
  });
  return NextResponse.json(updated);
}
