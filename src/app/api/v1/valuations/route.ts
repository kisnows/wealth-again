import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";
import { logAudit } from "@/server/services/audit";
import { ensureFxSnapshot } from "@/server/services/fx";
import { getUserFromRequest } from "@/server/utils/auth";
import {
  ensureIdempotent,
  markIdempotencyUsed,
} from "@/server/utils/idempotency";

/**
 * POST /api/v1/valuations
 * - 记录账户估值快照（SAVINGS 禁止）。
 * - 入参: { accountId: string, asOf: string(ISO), totalValue: number, currency?: string, fxRateId?: string }
 * - 返回: { todo: string }
 */

// POST /api/v1/valuations 记录账户估值快照（SAVINGS 禁止）
export async function POST(req: NextRequest) {
  const { accountId, asOf, totalValue, currency, fxRateId, note } =
    await req.json();
  if (!accountId || !asOf || typeof totalValue !== "number") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const user = await getUserFromRequest(req);
  if (!user || typeof user.id !== "string")
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account || account.userId !== user.id)
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  if (account.accountType === "SAVINGS") {
    return NextResponse.json(
      { error: "SAVINGS account does not accept valuation" },
      { status: 400 },
    );
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
    `${accountId}:${asOf}:${totalValue}`,
  );
  if (existed)
    return NextResponse.json(
      { error: "Idempotency key reused" },
      { status: 409 },
    );
  const asOfDate = new Date(asOf);
  if (Number.isNaN(asOfDate.getTime())) {
    return NextResponse.json({ error: "invalid asOf" }, { status: 400 });
  }
  const baseCurrency = account.baseCurrency.toUpperCase();
  const normalizedCurrency = typeof currency === "string" && currency.trim()
    ? currency.trim().toUpperCase()
    : baseCurrency;
  let snapshotId: string | null = null;
  let appliedRate = 1;
  if (normalizedCurrency !== baseCurrency) {
    try {
      const snapshot = await ensureFxSnapshot({
        base: baseCurrency,
        quote: normalizedCurrency,
        asOf: asOfDate,
        allowMissing: true,
      });
      if (snapshot) {
        snapshotId = snapshot.id;
        appliedRate = snapshot.rate;
      }
    } catch (error) {
      console.error("valuation fx snapshot ensure failed", error);
    }
  }
  const created = await prisma.valuationSnapshot.create({
    data: {
      accountId,
      asOf: asOfDate,
      totalValue,
      currency: normalizedCurrency,
      fxRateId: fxRateId || undefined,
      fxSnapshotId: snapshotId,
      fxAppliedRate: appliedRate,
      note,
    },
  });
  await logAudit("VALUATION_CREATE", {
    userId: user.id,
    meta: { accountId },
  });
  await markIdempotencyUsed(key);
  return NextResponse.json(created, { status: 201 });
}
