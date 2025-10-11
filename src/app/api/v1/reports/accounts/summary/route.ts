import { type NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/server/utils/auth";
import { computeAccountSummary } from "./utils";

/**
 * GET /api/v1/reports/accounts/summary?displayCurrency=CNY
 * - 返回账户层面的本金/估值/收益等汇总（账户币种 + 展示币种折算）。
 * - 返回: 501 TODO（占位），后续返回 Array<AccountSummary>
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const displayCurrency = searchParams.get("displayCurrency") || undefined;
  const user = await getUserFromRequest(req);
  if (!user || typeof user.id !== "string")
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const items = await computeAccountSummary(
    displayCurrency || undefined,
    user.id,
  );
  return NextResponse.json({ items, displayCurrency: displayCurrency || null });
}
