import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";
import { getUserFromRequest } from "@/server/utils/auth";

/**
 * GET /api/v1/accounts/:id/transactions
 * - 返回指定账户的全部交易明细（按发生时间倒序）。
 * - 仅限账户所有者访问。
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  const user = await getUserFromRequest(req);
  if (!user || typeof user.id !== "string") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account || account.userId !== user.id) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }
  const lines = await prisma.txnLine.findMany({
    where: { accountId: id },
    include: {
      entry: {
        select: {
          id: true,
          type: true,
          occurredAt: true,
          note: true,
          createdAt: true,
        },
      },
    },
    orderBy: [{ entry: { occurredAt: "desc" } }, { createdAt: "desc" }],
  });
  const items = lines.map((line) => ({
    id: line.id,
    entryId: line.entryId,
    type: line.entry.type,
    occurredAt: line.entry.occurredAt,
    createdAt: line.createdAt,
    amount: Number(line.amount),
    currency: line.currency,
    note: line.note ?? line.entry.note ?? null,
    entryNote: line.entry.note ?? null,
    lineNote: line.note ?? null,
    direction: Number(line.amount) >= 0 ? "INFLOW" : "OUTFLOW",
  }));
  return NextResponse.json({ items });
}
