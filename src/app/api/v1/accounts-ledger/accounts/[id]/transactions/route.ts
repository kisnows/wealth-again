import { type NextRequest, NextResponse } from "next/server";
import db from "@/server/db";
import { accounts, txnEntries, txnLines } from "@/server/db/schema";
import { getUserFromRequest } from "@/server/utils/auth";
import { desc, eq } from "drizzle-orm";

/**
 * GET /api/v1/accounts-ledger/accounts/:id/transactions
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
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, id))
    .limit(1);
  if (!account || account.userId !== user.id) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }
  const lines = await db
    .select({
      id: txnLines.id,
      entryId: txnLines.entryId,
      accountId: txnLines.accountId,
      amount: txnLines.amount,
      currency: txnLines.currency,
      note: txnLines.note,
      createdAt: txnLines.createdAt,
      counterpartyAccountId: txnLines.counterpartyAccountId,
      counterpartyName: txnLines.counterpartyName,
      exchangeRateAB: txnLines.exchangeRateAB,
      viaCurrency: txnLines.viaCurrency,
      rateAtoUSD: txnLines.rateAtoUSD,
      rateUSDtoB: txnLines.rateUSDtoB,
      fxEffectiveAt: txnLines.fxEffectiveAt,
      principalDelta: txnLines.principalDelta,
      valuationDelta: txnLines.valuationDelta,
      attachmentUrl: txnLines.attachmentUrl,
      entryType: txnEntries.type,
      entryOccurredAt: txnEntries.occurredAt,
      entryNote: txnEntries.note,
      entryCreatedAt: txnEntries.createdAt,
      counterpartyAccountName: accounts.name,
      counterpartyAccountCurrency: accounts.baseCurrency,
    })
    .from(txnLines)
    .innerJoin(txnEntries, eq(txnEntries.id, txnLines.entryId))
    .leftJoin(accounts, eq(accounts.id, txnLines.counterpartyAccountId))
    .where(eq(txnLines.accountId, id))
    .orderBy(desc(txnEntries.occurredAt), desc(txnLines.createdAt));
  const toNumber = (
    value: string | number | null | undefined,
  ) => {
    if (value == null) return null;
    return typeof value === "number" ? value : Number(value);
  };
  const items = lines.map((line) => ({
    id: line.id,
    entryId: line.entryId,
    type: line.entryType,
    occurredAt: line.entryOccurredAt,
    createdAt: line.createdAt,
    amount: toNumber(line.amount) ?? 0,
    currency: line.currency,
    note: line.note ?? line.entryNote ?? null,
    entryNote: line.entryNote ?? null,
    lineNote: line.note ?? null,
    direction: (toNumber(line.amount) ?? 0) >= 0 ? "INFLOW" : "OUTFLOW",
    counterpartyAccountId: line.counterpartyAccountId,
    counterpartyName:
      line.counterpartyName ?? line.counterpartyAccountName ?? null,
    counterpartyCurrency: line.counterpartyAccountCurrency ?? null,
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
