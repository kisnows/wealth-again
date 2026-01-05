import { type NextRequest, NextResponse } from "next/server";
import db from "@/server/db";
import { accounts } from "@/server/db/schema";
import { logAudit } from "@/server/services/audit";
import { getUserFromRequest } from "@/server/utils/auth";
import {
  ensureIdempotent,
  markIdempotencyUsed,
} from "@/server/utils/idempotency";
import { eq } from "drizzle-orm";

/**
 * GET /api/v1/accounts-ledger/accounts
 * - 列出账户（当前为全量，后续支持过滤与分页）。
 * 返回: Account[]
 *
 * POST /api/v1/accounts-ledger/accounts
 * - 创建账户。
 * 入参: { userId, name, accountType: "SAVINGS"|"INVESTMENT"|"LOAN", baseCurrency, initialBalance?, subType?, description? }
 * 返回: Account
 */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || typeof user.id !== "string")
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const list = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, user.id));
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const user = await getUserFromRequest(req);
  if (!user || typeof user.id !== "string")
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = user.id;
  const ACCOUNT_TYPES = new Set(["SAVINGS", "INVESTMENT", "LOAN", "OTHER"]);
  const name =
    typeof data.name === "string" && data.name.trim().length > 0
      ? data.name.trim()
      : null;
  const accountType =
    typeof data.accountType === "string"
      ? data.accountType.trim().toUpperCase()
      : "";
  const baseCurrency =
    typeof data.baseCurrency === "string"
      ? data.baseCurrency.trim().toUpperCase()
      : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!ACCOUNT_TYPES.has(accountType)) {
    return NextResponse.json({ error: "invalid accountType" }, { status: 400 });
  }
  if (!/^[A-Z]{3}$/.test(baseCurrency)) {
    return NextResponse.json({ error: "invalid baseCurrency" }, { status: 400 });
  }
  const initialBalance =
    data.initialBalance != null ? Number(data.initialBalance) : 0;
  if (!Number.isFinite(initialBalance) || initialBalance < 0) {
    return NextResponse.json(
      { error: "invalid initialBalance" },
      { status: 400 },
    );
  }
  const { key, existed } = await ensureIdempotent(req, userId, undefined);
  if (existed)
    return NextResponse.json(
      { error: "Idempotency key reused" },
      { status: 409 },
    );
  try {
    const [account] = await db
      .insert(accounts)
      .values({
        userId,
        name,
        accountType,
        baseCurrency,
        initialBalance: String(initialBalance),
        subType:
          typeof data.subType === "string" && data.subType.trim().length > 0
            ? data.subType.trim()
            : null,
        description:
          typeof data.description === "string" &&
          data.description.trim().length > 0
            ? data.description.trim()
            : null,
      })
      .returning();
    await logAudit("ACCOUNT_CREATE", {
      userId,
      meta: { accountId: account.id },
    });
    await markIdempotencyUsed(key);
    return NextResponse.json(account, { status: 201 });
  } catch (error: unknown) {
    console.error("ACCOUNT_CREATE_FAILED", error);
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
