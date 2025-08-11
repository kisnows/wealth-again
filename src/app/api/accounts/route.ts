import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  name: z.string(),
  baseCurrency: z.string().default("CNY"),
  userId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const body = schema.parse(await req.json());
  const userId = body.userId || (await ensureUser());
  const acc = await prisma.account.create({
    data: { name: body.name, baseCurrency: body.baseCurrency, userId },
  });
  return NextResponse.json({ id: acc.id });
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
