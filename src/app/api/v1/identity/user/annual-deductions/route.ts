import { type NextRequest, NextResponse } from "next/server";
import db from "@/server/db";
import { userAnnualDeductions } from "@/server/db/schema";
import { logAudit } from "@/server/services/audit";
import { scheduleIncomeRecalcTask } from "@/server/services/income-tax/income";
import { getUserFromRequest } from "@/server/utils/auth";
import {
  ensureIdempotent,
  markIdempotencyUsed,
} from "@/server/utils/idempotency";
import { desc, eq } from "drizzle-orm";

const ALLOCATION_RULES = new Set(["AVERAGE", "ONCE"]);

/**
 * GET /api/v1/identity/user/annual-deductions
 * - 返回当前用户（或 admin 指定 userId）的年度专项附加扣除记录。
 * POST /api/v1/identity/user/annual-deductions
 * - 创建或更新年度专项附加扣除（按 taxYear 去重）。
 */
export async function GET(req: NextRequest) {
  const viewer = await getUserFromRequest(req);
  if (!viewer)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const requestedUserId = searchParams.get("userId");
  const userId = requestedUserId ?? viewer.id;

  const items = await db
    .select()
    .from(userAnnualDeductions)
    .where(eq(userAnnualDeductions.userId, userId))
    .orderBy(desc(userAnnualDeductions.taxYear));

  return NextResponse.json({
    items: items.map((item) => ({
      id: item.id,
      taxYear: item.taxYear,
      annualAmount: Number(item.annualAmount || 0),
      allocationRule: item.allocationRule,
      note: item.note,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      userId: item.userId,
    })),
  });
}

export async function POST(req: NextRequest) {
  const viewer = await getUserFromRequest(req);
  if (!viewer)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | {
        taxYear?: unknown;
        annualAmount?: unknown;
        allocationRule?: unknown;
        note?: unknown;
      }
    | null;
  if (!body) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const taxYear = Number(body.taxYear);
  const annualAmount = Number(body.annualAmount);
  const allocationRule =
    body.allocationRule == null || body.allocationRule === ""
      ? null
      : String(body.allocationRule).toUpperCase();
  const note =
    typeof body.note === "string" && body.note.trim().length > 0
      ? body.note.trim()
      : null;

  if (!Number.isInteger(taxYear) || taxYear < 2000 || taxYear > 2100) {
    return NextResponse.json({ error: "invalid taxYear" }, { status: 400 });
  }
  if (!Number.isFinite(annualAmount) || annualAmount < 0) {
    return NextResponse.json({ error: "invalid annualAmount" }, { status: 400 });
  }
  if (allocationRule && !ALLOCATION_RULES.has(allocationRule)) {
    return NextResponse.json(
      { error: "invalid allocationRule" },
      { status: 400 },
    );
  }

  const userId = viewer.id;
  const { key, existed } = await ensureIdempotent(
    req,
    userId,
    `${userId}:${taxYear}:${annualAmount}:${allocationRule ?? "AVERAGE"}:${note ?? ""}`,
  );
  if (existed) {
    return NextResponse.json(
      { error: "Idempotency key reused" },
      { status: 409 },
    );
  }

  const [record] = await db
    .insert(userAnnualDeductions)
    .values({
      userId,
      taxYear,
      annualAmount: String(annualAmount),
      allocationRule: allocationRule ?? "AVERAGE",
      note,
    })
    .onConflictDoUpdate({
      target: [userAnnualDeductions.userId, userAnnualDeductions.taxYear],
      set: {
        annualAmount: String(annualAmount),
        allocationRule: allocationRule ?? "AVERAGE",
        note,
        updatedAt: new Date(),
      },
    })
    .returning();

  await logAudit("SETTINGS_ANNUAL_DEDUCTION_UPSERT", {
    userId,
    meta: {
      annualAmount,
      allocationRule: allocationRule ?? "AVERAGE",
      taxYear,
      id: record.id,
    },
  });

  await scheduleIncomeRecalcTask({
    userId,
    taxYear,
    startMonth: 1,
    endMonth: 12,
    triggeredBy: viewer.id,
  }).catch((error: unknown) => {
    console.error("annual deduction recalc schedule failed", error);
  });

  await markIdempotencyUsed(key);

  return NextResponse.json(
    {
      id: record.id,
      userId: record.userId,
      taxYear: record.taxYear,
      annualAmount: Number(record.annualAmount),
      allocationRule: record.allocationRule,
      note: record.note,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    },
    { status: 201 },
  );
}
