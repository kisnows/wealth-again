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
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user || typeof user.id !== "string") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account || account.userId !== user.id) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }
  const txnLineClient = prisma.txnLine as unknown as {
    findMany: (args: unknown) => Promise<
      Array<{
        id: string;
        entryId: string;
        accountId: string;
        amount: number | { toNumber: () => number };
        currency: string;
        note: string | null;
        createdAt: Date;
        counterpartyAccountId: string | null;
        counterpartyName: string | null;
        exchangeRateAB: number | { toNumber: () => number } | null;
        viaCurrency: string | null;
        rateAtoUSD: number | { toNumber: () => number } | null;
        rateUSDtoB: number | { toNumber: () => number } | null;
        fxEffectiveAt: Date | null;
        principalDelta: number | { toNumber: () => number } | null;
        valuationDelta: number | { toNumber: () => number } | null;
        entry: {
          id: string;
          type: string;
          occurredAt: Date;
          note: string | null;
          createdAt: Date;
        };
        counterpartyAccount?: {
          id: string;
          name: string;
          baseCurrency: string;
        } | null;
        attachmentUrl?: string | null;
      }>
    >;
  };
  const lines = await txnLineClient.findMany({
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
      counterpartyAccount: {
        select: { id: true, name: true, baseCurrency: true },
      },
    },
    orderBy: [{ entry: { occurredAt: "desc" } }, { createdAt: "desc" }],
  });
  const toNumber = (
    value: number | { toNumber: () => number } | null | undefined,
  ) => {
    if (value == null) return null;
    return typeof value === "number" ? value : value.toNumber();
  };
  const items = lines.map((line) => ({
    id: line.id,
    entryId: line.entryId,
    type: line.entry.type,
    occurredAt: line.entry.occurredAt,
    createdAt: line.createdAt,
    amount: toNumber(line.amount) ?? 0,
    currency: line.currency,
    note: line.note ?? line.entry.note ?? null,
    entryNote: line.entry.note ?? null,
    lineNote: line.note ?? null,
    direction: (toNumber(line.amount) ?? 0) >= 0 ? "INFLOW" : "OUTFLOW",
    counterpartyAccountId: line.counterpartyAccountId,
    counterpartyName:
      line.counterpartyName ?? line.counterpartyAccount?.name ?? null,
    counterpartyCurrency: line.counterpartyAccount?.baseCurrency ?? null,
    exchangeRateAB: toNumber(line.exchangeRateAB),
    viaCurrency: line.viaCurrency ?? null,
    rateAtoUSD: toNumber(line.rateAtoUSD),
    rateUSDtoB: toNumber(line.rateUSDtoB),
    fxEffectiveAt: line.fxEffectiveAt ?? null,
    principalDelta: toNumber(line.principalDelta) ?? toNumber(line.amount) ?? 0,
    valuationDelta: toNumber(line.valuationDelta) ?? toNumber(line.amount) ?? 0,
    attachmentUrl: line.attachmentUrl ?? null,
  }));
  return NextResponse.json({ items });
}
