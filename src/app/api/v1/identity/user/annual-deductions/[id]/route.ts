import { Prisma } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";
import { logAudit } from "@/server/services/audit";
import { scheduleIncomeRecalcTask } from "@/server/services/income-tax/income";
import { getUserFromRequest } from "@/server/utils/auth";
import {
  ensureIdempotent,
  markIdempotencyUsed,
} from "@/server/utils/idempotency";

const ALLOCATION_RULES = new Set(["AVERAGE", "ONCE"]);

type RouteContext = {
  params: { id: string };
};

export async function PATCH(req: NextRequest, context: RouteContext) {
  const viewer = await getUserFromRequest(req);
  if (!viewer)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const deductionId = context.params.id;
  if (!deductionId) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  const existing = await prisma.userAnnualDeduction.findUnique({
    where: { id: deductionId },
  });
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (existing.userId !== viewer.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

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

  const data: {
    taxYear?: number;
    annualAmount?: Prisma.Decimal;
    allocationRule?: string | null;
    note?: string | null;
  } = {};
  let targetTaxYear = existing.taxYear;

  if (body.taxYear !== undefined) {
    const taxYear = Number(body.taxYear);
    if (!Number.isInteger(taxYear) || taxYear < 2000 || taxYear > 2100) {
      return NextResponse.json({ error: "invalid taxYear" }, { status: 400 });
    }
    data.taxYear = taxYear;
    targetTaxYear = taxYear;
  }

  if (body.annualAmount !== undefined) {
    const annualAmount = Number(body.annualAmount);
    if (!Number.isFinite(annualAmount) || annualAmount < 0) {
      return NextResponse.json(
        { error: "invalid annualAmount" },
        { status: 400 },
      );
    }
    data.annualAmount = new Prisma.Decimal(annualAmount);
  }

  if (body.allocationRule !== undefined) {
    const allocationRule =
      body.allocationRule == null || body.allocationRule === ""
        ? null
        : String(body.allocationRule).toUpperCase();
    if (allocationRule && !ALLOCATION_RULES.has(allocationRule)) {
      return NextResponse.json(
        { error: "invalid allocationRule" },
        { status: 400 },
      );
    }
    data.allocationRule = allocationRule ?? "AVERAGE";
  }

  if (body.note !== undefined) {
    data.note =
      typeof body.note === "string" && body.note.trim().length > 0
        ? body.note.trim()
        : null;
  }

  if (
    data.taxYear === undefined &&
    data.annualAmount === undefined &&
    data.allocationRule === undefined &&
    data.note === undefined
  ) {
    return NextResponse.json({ error: "empty update" }, { status: 400 });
  }

  const { key, existed } = await ensureIdempotent(
    req,
    viewer.id,
    `${deductionId}:${JSON.stringify(body)}`,
  );
  if (existed) {
    return NextResponse.json(
      { error: "Idempotency key reused" },
      { status: 409 },
    );
  }

  const updated = await prisma.userAnnualDeduction.update({
    where: { id: deductionId },
    data,
  });

  await logAudit("SETTINGS_ANNUAL_DEDUCTION_UPDATE", {
    userId: viewer.id,
    meta: {
      id: deductionId,
      before: {
        taxYear: existing.taxYear,
        annualAmount: Number(existing.annualAmount),
        allocationRule: existing.allocationRule,
        note: existing.note,
      },
      after: {
        taxYear: updated.taxYear,
        annualAmount: Number(updated.annualAmount),
        allocationRule: updated.allocationRule,
        note: updated.note,
      },
    },
  });

  const yearsToRecalc = new Set<number>([
    existing.taxYear,
    updated.taxYear,
    targetTaxYear,
  ]);
  await Promise.all(
    Array.from(yearsToRecalc).map((taxYear) =>
      scheduleIncomeRecalcTask({
        userId: viewer.id,
        taxYear,
        startMonth: 1,
        endMonth: 12,
        triggeredBy: viewer.id,
      }).catch((error: unknown) => {
        console.error(
          "annual deduction recalc schedule failed during update",
          error,
        );
      }),
    ),
  );

  await markIdempotencyUsed(key);

  return NextResponse.json({
    id: updated.id,
    userId: updated.userId,
    taxYear: updated.taxYear,
    annualAmount: Number(updated.annualAmount),
    allocationRule: updated.allocationRule,
    note: updated.note,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  });
}
