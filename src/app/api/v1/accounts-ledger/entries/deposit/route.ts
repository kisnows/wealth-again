import { type NextRequest, NextResponse } from "next/server";
import { logAudit } from "@/server/services/audit";
import { postDeposit } from "@/server/services/accounts-ledger/ledger";
import { getUserFromRequest } from "@/server/utils/auth";
import {
  ensureIdempotent,
  markIdempotencyUsed,
} from "@/server/utils/idempotency";

/**
 * POST /api/v1/accounts-ledger/entries/deposit
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
  let entry;
  try {
    entry = await postDeposit({
      accountId,
      amount: depositAmount,
      occurredAt: occurredAtDate.toISOString(),
      note,
      attachmentUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Account not found") {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    if (message === "account is archived") {
      return NextResponse.json(
        { error: "account is archived" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "deposit failed" }, { status: 500 });
  }
  await logAudit("ENTRY_DEPOSIT", {
    userId: user.id,
    meta: { entryId: entry.id },
  });
  await markIdempotencyUsed(key);
  return NextResponse.json(entry, { status: 201 });
}
