import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";
import { ensureIdempotent, markIdempotencyUsed } from "@/server/utils/idempotency";
import { logAudit } from "@/server/services/audit";

/**
 * GET /api/v1/accounts
 * - 列出账户（当前为全量，后续支持过滤与分页）。
 * 返回: Account[]
 *
 * POST /api/v1/accounts
 * - 创建账户。
 * 入参: { userId, name, accountType: "SAVINGS"|"INVESTMENT"|"LOAN", baseCurrency, initialBalance?, subType?, description? }
 * 返回: Account
 */
export async function GET() {
  const accounts = await prisma.account.findMany();
  return NextResponse.json(accounts);
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const { key, existed } = await ensureIdempotent(req, data.userId, undefined);
  if (existed) return NextResponse.json({ error: "Idempotency key reused" }, { status: 409 });
  const account = await prisma.account.create({
    data: {
      userId: data.userId,
      name: data.name,
      accountType: data.accountType,
      baseCurrency: data.baseCurrency,
      initialBalance: data.initialBalance ?? 0,
      subType: data.subType,
      description: data.description,
    },
  });
  await logAudit("ACCOUNT_CREATE", { userId: data.userId, meta: { accountId: account.id } });
  await markIdempotencyUsed(key);
  return NextResponse.json(account, { status: 201 });
}
