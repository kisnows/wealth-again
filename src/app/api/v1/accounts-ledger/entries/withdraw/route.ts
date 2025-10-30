import type { Prisma } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";
import { logAudit } from "@/server/services/audit";
import { writeOutboxEvent } from "@/server/services/outbox";
import { getUserFromRequest } from "@/server/utils/auth";
import {
  ensureIdempotent,
  markIdempotencyUsed,
} from "@/server/utils/idempotency";

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
  const account = await prisma.account.findUnique({ where: { id: accountId } });
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
    amount: -normalizedAmount,
    currency: account.baseCurrency,
    fxSnapshotId: null,
    fxAppliedRate: 1,
    fxEffectiveAt: occurredAtDate,
    principalDelta: -normalizedAmount,
    valuationDelta: -normalizedAmount,
    note,
    attachmentUrl:
      typeof attachmentUrl === "string" && attachmentUrl.trim().length > 0
        ? attachmentUrl.trim()
        : undefined,
  } satisfies Record<string, unknown>;
  const entry = await prisma.$transaction(async (tx) => {
    const created = await tx.txnEntry.create({
      data: {
        userId: user.id,
        type: "WITHDRAW",
        occurredAt: occurredAtDate,
        fxSnapshotId: null,
        fxAppliedRate: 1,
        note,
        lines: {
          create: [
            lineInput as unknown as Prisma.TxnLineCreateWithoutEntryInput,
          ],
        },
      },
      include: { lines: true },
    });
    const lines = Array.isArray(created.lines) ? created.lines : [];
    await writeOutboxEvent(tx, {
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
    return created;
  });
  await logAudit("ENTRY_WITHDRAW", {
    userId: user.id,
    meta: { entryId: entry.id },
  });
  await markIdempotencyUsed(key);
  return NextResponse.json(entry, { status: 201 });
}
