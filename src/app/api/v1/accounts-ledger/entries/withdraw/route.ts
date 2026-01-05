import { type NextRequest, NextResponse } from "next/server";
import db from "@/server/db";
import { accounts, txnEntries, txnLines } from "@/server/db/schema";
import { logAudit } from "@/server/services/audit";
import { writeOutboxEventSync } from "@/server/services/outbox";
import { getUserFromRequest } from "@/server/utils/auth";
import {
  ensureIdempotent,
  markIdempotencyUsed,
} from "@/server/utils/idempotency";
import { eq } from "drizzle-orm";

/**
 * POST /api/v1/accounts-ledger/entries/withdraw
 * - 提取资金（账户币种记账）。
 * - 入参: { accountId: string, amount: number, occurredAt: ISOString, note?: string }
 * - 返回: TxnEntry（含 lines）
 */
export async function POST(req: NextRequest) {
  const { accountId, amount, occurredAt, note, attachmentUrl } =
    await req.json();
  const user = await getUserFromRequest(req);
  if (!user || typeof user.id !== "string")
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);
  if (!account || account.userId !== user.id) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  if ((account.status ?? "ACTIVE") === "ARCHIVED") {
    return NextResponse.json(
      { error: "account is archived" },
      { status: 409 },
    );
  }
  const { key, existed } = await ensureIdempotent(
    req,
    user.id,
    `${accountId}:${amount}:${occurredAt}:${note ?? ""}`,
  );
  if (existed)
    return NextResponse.json(
      { error: "Idempotency key reused" },
      { status: 409 },
    );
  const occurredAtDate = new Date(occurredAt);
  if (Number.isNaN(occurredAtDate.getTime())) {
    return NextResponse.json({ error: "invalid occurredAt" }, { status: 400 });
  }
  const normalizedAmount = Math.abs(Number(amount));
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    return NextResponse.json({ error: "invalid amount" }, { status: 400 });
  }
  const lineInput = {
    accountId,
    type: "WITHDRAW",
    amount: String(-normalizedAmount),
    currency: account.baseCurrency,
    fxSnapshotId: null,
    fxAppliedRate: "1",
    fxEffectiveAt: occurredAtDate,
    principalDelta: String(-normalizedAmount),
    valuationDelta: String(-normalizedAmount),
    note,
    attachmentUrl:
      typeof attachmentUrl === "string" && attachmentUrl.trim().length > 0
        ? attachmentUrl.trim()
        : undefined,
  };
  const entry = await db.transaction((tx) => {
    const created = tx
      .insert(txnEntries)
      .values({
        userId: user.id,
        type: "WITHDRAW",
        occurredAt: occurredAtDate,
        fxSnapshotId: null,
        fxAppliedRate: "1",
        note,
      })
      .returning()
      .get();
    if (!created) {
      throw new Error("ledger_entry_create_failed");
    }
    const line = tx
      .insert(txnLines)
      .values({ ...lineInput, entryId: created.id })
      .returning()
      .get();
    if (!line) {
      throw new Error("ledger_line_create_failed");
    }
    const lines = [line];
    writeOutboxEventSync(tx, {
      eventType: "ledger.entry.created",
      payload: {
        entryId: created.id,
        type: "WITHDRAW",
        userId: user.id,
        occurredAt: occurredAtDate.toISOString(),
        accountIds: lines.map((line) => line.accountId),
        totalAmount: normalizedAmount,
        currency: account.baseCurrency,
        direction: "OUTFLOW",
        lines: lines.map((line) => ({
          id: line.id,
          accountId: line.accountId,
          amount: Number(line.amount ?? 0),
          currency: line.currency,
        })),
      },
    });
    return { ...created, lines };
  });
  await logAudit("ENTRY_WITHDRAW", {
    userId: user.id,
    meta: { entryId: entry.id },
  });
  await markIdempotencyUsed(key);
  return NextResponse.json(entry, { status: 201 });
}
