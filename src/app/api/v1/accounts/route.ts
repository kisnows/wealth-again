import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";

export async function GET() {
  const accounts = await prisma.account.findMany();
  return NextResponse.json(accounts);
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const account = await prisma.account.create({
    data: {
      userId: data.userId,
      name: data.name,
      accountType: data.accountType,
      baseCurrency: data.baseCurrency,
      initialBalance: data.initialBalance ?? 0,
      subType: data.subType,
      description: data.description,
    },
  });
  return NextResponse.json(account, { status: 201 });
}
