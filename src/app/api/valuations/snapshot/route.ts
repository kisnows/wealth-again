import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  accountId: z.string().uuid(),
  asOf: z.string(),
  totalValue: z.number(),
});

export async function POST(req: NextRequest) {
  const body = schema.parse(await req.json());
  const snap = await prisma.valuationSnapshot.upsert({
    where: {
      accountId_asOf: { accountId: body.accountId, asOf: new Date(body.asOf) },
    },
    update: { totalValue: body.totalValue.toString(), breakdown: {} },
    create: {
      accountId: body.accountId,
      asOf: new Date(body.asOf),
      totalValue: body.totalValue.toString(),
      breakdown: {},
    },
  });
  return NextResponse.json({ id: snap.id });
}
