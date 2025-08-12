import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const postSchema = z.object({
  city: z.string(),
  grossMonthly: z.number().positive(),
  effectiveFrom: z.string(),
  userId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const body = postSchema.parse(await req.json());
  const userId = body.userId || (await ensureUser());
  const rec = await prisma.incomeChange.create({
    data: {
      userId,
      city: body.city,
      grossMonthly: body.grossMonthly.toString(),
      effectiveFrom: new Date(body.effectiveFrom),
    },
  });
  return NextResponse.json({ id: rec.id });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city") || "Hangzhou";
  const page = Number(searchParams.get("page") || "1");
  const pageSize = Number(searchParams.get("pageSize") || "50");
  const user = await prisma.user.findFirst();
  if (!user)
    return NextResponse.json({ records: [], total: 0, page, pageSize });
  const skip = (page - 1) * pageSize;
  const [total, records] = await Promise.all([
    prisma.incomeChange.count({ where: { userId: user.id, city } }),
    prisma.incomeChange.findMany({
      where: { userId: user.id, city },
      orderBy: { effectiveFrom: "desc" },
      skip,
      take: pageSize,
    }),
  ]);
  return NextResponse.json({ records, total, page, pageSize });
}

async function ensureUser() {
  const u = await prisma.user.findFirst();
  if (u) return u.id;
  const bcrypt = await import("bcryptjs");
  const hash = await bcrypt.hash("demo123", 10);
  const user = await prisma.user.create({
    data: { email: "demo@example.com", password: hash, name: "Demo" },
  });
  return user.id;
}
