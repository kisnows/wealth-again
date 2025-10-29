import type { Prisma } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";
import { logAudit } from "@/server/services/audit";
import { getUserFromRequest } from "@/server/utils/auth";
import {
  ensureIdempotent,
  markIdempotencyUsed,
} from "@/server/utils/idempotency";

/**
 * POST /api/v1/entries/deposit
 * - 存入资金（账户币种记账）。
 * - 入参: { accountId: string, amount: number, occurredAt: ISOString, note?: string }
 * - 返回: TxnEntry（含 lines）
 */
export async function POST(req: NextRequest) {
  const { accountId, amount, occurredAt, note, attachmentUrl } =
    await req.json();
  const user = await getUserFromRequest(req);
  if (!user || typeof user.id !== "string")
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const depositAmount = Number(amount);
  if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
    return NextResponse.json({ error: "invalid amount" }, { status: 400 });
  }
  const occurredAtDate = new Date(occurredAt);
  if (Number.isNaN(occurredAtDate.getTime())) {
    return NextResponse.json({ error: "invalid occurredAt" }, { status: 400 });
  }
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
    `${accountId}:${depositAmount}:${occurredAt}:${note ?? ""}`,
  );
  if (existed)
    return NextResponse.json(
      { error: "Idempotency key reused" },
      { status: 409 },
    );
  const entry = await prisma.$transaction(async (tx) => {
    const lineInput = {
      accountId,
      type: "DEPOSIT",
      amount: depositAmount,
      currency: account.baseCurrency,
      fxSnapshotId: null,
      fxAppliedRate: 1,
      fxEffectiveAt: occurredAtDate,
      principalDelta: depositAmount,
      valuationDelta: depositAmount,
      note,
      attachmentUrl:
        typeof attachmentUrl === "string" && attachmentUrl.trim().length > 0
          ? attachmentUrl.trim()
          : undefined,
    } satisfies Record<string, unknown>;
    const createdEntry = await tx.txnEntry.create({
      data: {
        userId: user.id,
        type: "DEPOSIT",
        occurredAt: occurredAtDate,
        fxSnapshotId: null,
        fxAppliedRate: 1,
        note,
        lines: {
          create: lineInput as unknown as Prisma.TxnLineCreateWithoutEntryInput,
        },
      },
      include: { lines: true },
    });
    if (account.accountType === "INVESTMENT") {
      const [latestSnapshot, lineSum] = await Promise.all([
        tx.valuationSnapshot.findFirst({
          where: { accountId },
          orderBy: { asOf: "desc" },
        }),
        tx.txnLine.aggregate({
          where: { accountId },
          _sum: { amount: true },
        }),
      ]);
      const summedAmount =
        lineSum._sum.amount != null ? Number(lineSum._sum.amount) : 0;
      const principalAfter = Number(account.initialBalance ?? 0) + summedAmount;
      const previousValue =
        latestSnapshot?.totalValue?.toNumber() ??
        principalAfter - depositAmount;
      const newValue = previousValue + depositAmount;
      const snapshotCurrency = latestSnapshot?.currency ?? account.baseCurrency;
      const snapshotFxRateId = latestSnapshot?.fxRateId ?? null;
       const snapshotFxSnapshotId = latestSnapshot?.fxSnapshotId ?? null;
       const snapshotFxAppliedRate =
        latestSnapshot?.fxAppliedRate != null
          ? Number(latestSnapshot.fxAppliedRate)
          : 1;
      const snapshotNote = latestSnapshot?.note ?? null;
      await tx.valuationSnapshot.upsert({
        where: {
          accountId_asOf: { accountId, asOf: occurredAtDate },
        },
        update: {
          totalValue: newValue,
          currency: snapshotCurrency,
          fxRateId: snapshotFxRateId,
          fxSnapshotId: snapshotFxSnapshotId,
          fxAppliedRate: snapshotFxAppliedRate,
          note: snapshotNote,
        },
        create: {
          accountId,
          asOf: occurredAtDate,
          totalValue: newValue,
          currency: snapshotCurrency,
          fxRateId: snapshotFxRateId,
          fxSnapshotId: snapshotFxSnapshotId,
          fxAppliedRate: snapshotFxAppliedRate,
          note: note ?? snapshotNote,
        },
      });
    }
    return createdEntry;
  });
  await logAudit("ENTRY_DEPOSIT", {
    userId: user.id,
    meta: { entryId: entry.id },
  });
  await markIdempotencyUsed(key);
  return NextResponse.json(entry, { status: 201 });
}
