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
  // Duplicate name check per user
  const exists = await prisma.account.findFirst({
    where: { userId, name: body.name },
    select: { id: true },
  });
  if (exists) {
    return NextResponse.json({ error: "account_name_exists" }, { status: 409 });
  }
  const acc = await prisma.account.create({
    data: { name: body.name, baseCurrency: body.baseCurrency, userId },
  });
  return NextResponse.json({ id: acc.id });
}

export async function GET() {
  const user = await prisma.user.findFirst();
  const accounts = await prisma.account.findMany({
    where: user ? { userId: user.id } : undefined,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ accounts });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  // clean dependencies
  await prisma.transaction.deleteMany({ where: { accountId: id } });
  await prisma.valuationSnapshot.deleteMany({ where: { accountId: id } });
  await prisma.lot.deleteMany({ where: { accountId: id } });
  await prisma.account.delete({ where: { id } });
  return NextResponse.json({ ok: true });
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
