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
});

export async function POST(req: NextRequest) {
  const body = schema.parse(await req.json());
  const userId = body.userId || (await ensureDemoUser());
  const rec = await prisma.incomeRecord.upsert({
    where: {
      userId_year_month: { userId, year: body.year, month: body.month },
    },
    update: {
      gross: body.gross.toString(),
      bonus: body.bonus?.toString(),
      overrides: body.overrides,
    },
    create: {
      userId,
      city: body.city,
      year: body.year,
      month: body.month,
      gross: body.gross.toString(),
      bonus: body.bonus?.toString(),
      overrides: body.overrides,
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
