import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TaxService, TaxConfigRepository } from "@/lib/tax";
import { incomeCalculationInputSchema } from "@/lib/tax/types";
import { ZodError } from "zod";

const repository = new TaxConfigRepository(prisma);
const taxService = new TaxService(repository);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = incomeCalculationInputSchema.parse(body);

    const result = await taxService.calculateMonthlyIncome(input);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "invalid_input",
          issues: err.issues,
        },
        { status: 400 }
      );
    }

    console.error("POST /api/income/calculate error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "internal_error",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  if (!userId) {
    return NextResponse.json(
      { success: false, error: "userId required" },
      { status: 400 }
    );
  }

  try {
    if (year && month) {
      // 获取特定月份的收入记录
      const record = await repository.getIncomeRecord(
        userId,
        parseInt(year),
        parseInt(month)
      );

      return NextResponse.json({
        success: true,
        data: record,
      });
    } else if (year) {
      // 获取年度汇总
      const summary = await taxService.getAnnualSummary(userId, parseInt(year));

      return NextResponse.json({
        success: true,
        data: summary,
      });
    } else {
      return NextResponse.json(
        { success: false, error: "year parameter required" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("GET /api/income/calculate error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "internal_error",
      },
      { status: 500 }
    );
  }
}
