import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  city: z.string(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  gross: z.number().positive(),
  bonus: z.number().optional(),
  overrides: z.record(z.any()).optional(),
  userId: z.string().uuid().optional(),
  // 新增：可选的生效日期，用于记录更改的有效期（默认当前月最后一日）
  effectiveDate: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = schema.parse(await req.json());
  const userId = body.userId || (await ensureDemoUser());
  const effectiveDate = body.effectiveDate
    ? new Date(body.effectiveDate)
    : new Date(body.year, body.month, 0); // 当月最后一天
  const rec = await prisma.incomeRecord.upsert({
    where: {
      userId_year_month: { userId, year: body.year, month: body.month },
    },
    update: {
      gross: body.gross.toString(),
      bonus: body.bonus?.toString(),
      overrides: body.overrides ? JSON.stringify(body.overrides) : undefined,
    },
    create: {
      userId,
      city: body.city,
      year: body.year,
      month: body.month,
      gross: body.gross.toString(),
      bonus: body.bonus?.toString(),
      overrides: body.overrides ? JSON.stringify(body.overrides) : undefined,
    },
  });
  // 记录变更轨迹：工资按月度生效
  await prisma.incomeChange.create({
    data: {
      userId,
      city: body.city,
      grossMonthly: body.gross.toString(),
      effectiveFrom: effectiveDate,
    },
  });
  return NextResponse.json({ id: rec.id });
}

async function ensureDemoUser() {
  const u = await prisma.user.findFirst();
  if (u) return u.id;
  const bcrypt = await import("bcryptjs");
  const hash = await bcrypt.hash("demo123", 10);
  const user = await prisma.user.create({
    data: { email: "demo@example.com", password: hash, name: "Demo" },
  });
  return user.id;
}
