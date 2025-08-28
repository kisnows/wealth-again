import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";
import { logAudit } from "@/server/services/audit";
import { getUserFromRequest } from "@/server/utils/auth";
import {
  ensureIdempotent,
  markIdempotencyUsed,
} from "@/server/utils/idempotency";

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
export async function GET(req: NextRequest) {
  const { getUserFromRequest } = await import("@/server/utils/auth");
  const user = await getUserFromRequest(req);
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const _accounts = await prisma.account.findMany({
    where: { id: undefined as any },
  });
  // prisma types workaround above: re-query properly
  const list = await prisma.account.findMany({
    where: { userId: (user as any).id },
  });
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const user = await getUserFromRequest(req);
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = user.id;
  const { key, existed } = await ensureIdempotent(req, userId, undefined);
  if (existed)
    return NextResponse.json(
      { error: "Idempotency key reused" },
      { status: 409 },
    );
  try {
    const account = await prisma.account.create({
      data: {
        userId,
        name: data.name,
        accountType: data.accountType,
        baseCurrency: data.baseCurrency,
        initialBalance: data.initialBalance ?? 0,
        subType: data.subType,
        description: data.description,
      },
    });
    await logAudit("ACCOUNT_CREATE", {
      userId,
      meta: { accountId: account.id },
    });
    await markIdempotencyUsed(key);
    return NextResponse.json(account, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2003") {
      return NextResponse.json(
        { error: "invalid userId (foreign key)" },
        { status: 400 },
      );
    }
    throw e;
  }
}
