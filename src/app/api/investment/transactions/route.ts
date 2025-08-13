import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { z } from "zod";

const createTransactionSchema = z.object({
  accountId: z.string().uuid(),
  type: z.enum(["BUY", "SELL", "DEPOSIT", "WITHDRAW", "DIVIDEND", "FEE"]),
  tradeDate: z.string(),
  instrumentId: z.string().uuid().optional(),
  quantity: z.number().optional(),
  price: z.number().optional(),
  cashAmount: z.number(),
  currency: z.string().default("CNY"),
  fee: z.number().default(0),
  tax: z.number().default(0),
  note: z.string().optional(),
});

const updateTransactionSchema = createTransactionSchema.partial().omit({ accountId: true });

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUser(req);
    const body = createTransactionSchema.parse(await req.json());

    // 验证账户所有权
    const account = await prisma.account.findFirst({
      where: { id: body.accountId, userId }
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "无权访问此账户" } },
        { status: 403 }
      );
    }

    // 验证投资标的（如果有）
    if (body.instrumentId) {
      const instrument = await prisma.instrument.findUnique({
        where: { id: body.instrumentId }
      });
      
      if (!instrument) {
        return NextResponse.json(
          { success: false, error: { code: "NOT_FOUND", message: "投资标的不存在" } },
          { status: 404 }
        );
      }
    }

    const transaction = await prisma.transaction.create({
      data: {
        accountId: body.accountId,
        type: body.type,
        tradeDate: new Date(body.tradeDate),
        instrumentId: body.instrumentId,
        quantity: body.quantity?.toString(),
        price: body.price?.toString(),
        cashAmount: body.cashAmount.toString(),
        currency: body.currency,
        fee: body.fee?.toString(),
        tax: body.tax?.toString(),
        note: body.note,
      },
      include: {
        account: {
          select: { name: true }
        },
        instrument: {
          select: { symbol: true, type: true }
        }
      }
    });

    return NextResponse.json({ 
      success: true,
      data: transaction
    });

  } catch (error) {
    console.error("Transaction creation error:", error);
    
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

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUser(req);
    const { searchParams } = new URL(req.url);
    
    const accountId = searchParams.get("accountId");
    const type = searchParams.get("type");
    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || "20")));
    const skip = (page - 1) * pageSize;

    // 构建查询条件
    const where: any = {};
    
    if (accountId) {
      // 验证账户所有权
      const account = await prisma.account.findFirst({
        where: { id: accountId, userId }
      });
      
      if (!account) {
        return NextResponse.json(
          { success: false, error: { code: "FORBIDDEN", message: "无权访问此账户" } },
          { status: 403 }
        );
      }
      
      where.accountId = accountId;
    } else {
      // 如果不指定账户，则查询用户所有账户的交易
      const userAccounts = await prisma.account.findMany({
        where: { userId },
        select: { id: true }
      });
      
      where.accountId = {
        in: userAccounts.map(acc => acc.id)
      };
    }

    if (type) {
      where.type = type;
    }

    const [total, transactions] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        orderBy: { tradeDate: "desc" },
        skip,
        take: pageSize,
        include: {
          account: {
            select: { name: true }
          },
          instrument: {
            select: { symbol: true, type: true }
          }
        }
      })
    ]);

    return NextResponse.json({ 
      success: true,
      data: transactions,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });

  } catch (error) {
    console.error("Transaction list error:", error);
    
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