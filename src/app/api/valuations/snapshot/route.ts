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
  
  // 将日期字符串转换为当天的开始和结束时间
  const asOfDate = new Date(body.asOf);
  const startOfDay = new Date(asOfDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(asOfDate);
  endOfDay.setHours(23, 59, 59, 999);
  
  // 查找同一天内是否已存在快照记录
  const existingSnapshot = await prisma.valuationSnapshot.findFirst({
    where: {
      accountId: body.accountId,
      asOf: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });
  
  let snap;
  if (existingSnapshot) {
    // 如果存在，则更新现有记录
    snap = await prisma.valuationSnapshot.update({
      where: { id: existingSnapshot.id },
      data: {
        totalValue: body.totalValue.toString(),
        asOf: asOfDate, // 更新时间戳为提供的具体时间
      },
    });
  } else {
    // 如果不存在，则创建新记录
    snap = await prisma.valuationSnapshot.create({
      data: {
        accountId: body.accountId,
        asOf: asOfDate,
        totalValue: body.totalValue.toString(),
      },
    });
  }
  
  return NextResponse.json({ id: snap.id });
}
