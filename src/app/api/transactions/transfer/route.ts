import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { z } from "zod";

const schema = z.object({
  fromAccountId: z.string().uuid(),
  toAccountId: z.string().uuid(),
  amount: z.number().positive(),
  date: z.string(),
  currency: z.string().default("CNY"),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUser(req);
    const body = schema.parse(await req.json());
    const date = new Date(body.date);
    const amount = body.amount;
    
    // 验证账户所有权
    const [fromAccount, toAccount] = await Promise.all([
      prisma.account.findFirst({
        where: { id: body.fromAccountId, userId }
      }),
      prisma.account.findFirst({
        where: { id: body.toAccountId, userId }
      })
    ]);
    
    if (!fromAccount) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "无权访问转出账户" } },
        { status: 403 }
      );
    }
    
    if (!toAccount) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "无权访问转入账户" } },
        { status: 403 }
      );
    }
    
    const [outTx, inTx] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          accountId: body.fromAccountId,
          type: "TRANSFER_OUT",
          tradeDate: date,
          amount: amount.toString(),
          currency: body.currency,
        },
      }),
      prisma.transaction.create({
        data: {
          accountId: body.toAccountId,
          type: "TRANSFER_IN",
          tradeDate: date,
          amount: amount.toString(),
          currency: body.currency,
        },
      }),
    ]);
    
    return NextResponse.json({ 
      success: true,
      data: { fromId: outTx.id, toId: inTx.id } 
    });
    
  } catch (error) {
    console.error("Transfer error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: error.errors[0].message } },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "请先登录" } },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "服务器内部错误" } },
      { status: 500 }
    );
  }
}
