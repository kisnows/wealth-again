import { type NextRequest, NextResponse } from "next/server";
import db from "@/server/db";
import { accounts, txnLines, valuationSnapshots } from "@/server/db/schema";
import { logAudit } from "@/server/services/audit";
import { getUserFromRequest } from "@/server/utils/auth";
import { eq } from "drizzle-orm";

/**
 * PATCH /api/v1/accounts-ledger/accounts/:id
 * - 仅允许更新: name, subType, description, status
 * - 禁止: baseCurrency 修改
 * - 入参: { name?: string, subType?: string, description?: string, status?: "ACTIVE"|"ARCHIVED" }
 * - 返回: 501 TODO（占位），后续返回更新后的 Account
 */

// PATCH /api/v1/accounts-ledger/accounts/:id 仅允许 name/subType/description/status（禁止修改 baseCurrency）
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  const body = await req.json();
  const user = await getUserFromRequest(req);
  if (!user || typeof user.id !== "string")
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id: userId } = user;
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, id))
    .limit(1);
  if (!account || account.userId !== userId)
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  const allowed: Record<string, unknown> = {};
  for (const k of ["name", "subType", "description", "status"]) {
    if (k in body) allowed[k] = body[k];
  }
  if ("baseCurrency" in body) {
    return NextResponse.json(
      { error: "baseCurrency is immutable" },
      { status: 400 },
    );
  }
  const [updated] = await db
    .update(accounts)
    .set(allowed)
    .where(eq(accounts.id, id))
    .returning();
  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  const user = await getUserFromRequest(req);
  if (!user || typeof user.id !== "string")
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id: userId } = user;
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, id))
    .limit(1);
  if (!account || account.userId !== userId)
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  const [lineHit] = await db
    .select({ id: txnLines.id })
    .from(txnLines)
    .where(eq(txnLines.accountId, id))
    .limit(1);
  const [valuationHit] = await db
    .select({ id: valuationSnapshots.id })
    .from(valuationSnapshots)
    .where(eq(valuationSnapshots.accountId, id))
    .limit(1);
  if (lineHit || valuationHit) {
    return NextResponse.json(
      { error: "account_has_related_records" },
      { status: 409 },
    );
  }
  await db.delete(accounts).where(eq(accounts.id, id));
  await logAudit("ACCOUNT_DELETE", {
    userId,
    meta: { accountId: id },
  });
  return NextResponse.json({ id });
}
