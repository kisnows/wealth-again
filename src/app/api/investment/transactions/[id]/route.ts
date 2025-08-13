import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { z } from "zod";

const updateTransactionSchema = z.object({
  type: z.enum(["BUY", "SELL", "DEPOSIT", "WITHDRAW", "DIVIDEND", "FEE"]).optional(),
  tradeDate: z.string().optional(),
  instrumentId: z.string().uuid().optional(),
  quantity: z.number().optional(),
  price: z.number().optional(),
  cashAmount: z.number().optional(),
  currency: z.string().optional(),
  fee: z.number().optional(),
  tax: z.number().optional(),
  note: z.string().optional(),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getCurrentUser(req);
    const { id } = params;

    const transaction = await prisma.transaction.findFirst({
      where: { 
        id,
        account: { userId } // 通过account关联确保用户权限
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

    if (!transaction) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "交易记录不存在" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      success: true,
      data: transaction
    });

  } catch (error) {
    console.error("Transaction get error:", error);
    
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

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getCurrentUser(req);
    const { id } = params;
    const body = updateTransactionSchema.parse(await req.json());

    // 验证交易记录存在且用户有权限
    const existingTransaction = await prisma.transaction.findFirst({
      where: { 
        id,
        account: { userId }
      }
    });

    if (!existingTransaction) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "交易记录不存在" } },
        { status: 404 }
      );
    }

    // 验证投资标的（如果有更新）
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

    const updateData: any = {};
    
    if (body.type !== undefined) updateData.type = body.type;
    if (body.tradeDate !== undefined) updateData.tradeDate = new Date(body.tradeDate);
    if (body.instrumentId !== undefined) updateData.instrumentId = body.instrumentId;
    if (body.quantity !== undefined) updateData.quantity = body.quantity.toString();
    if (body.price !== undefined) updateData.price = body.price.toString();
    if (body.cashAmount !== undefined) updateData.cashAmount = body.cashAmount.toString();
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (body.fee !== undefined) updateData.fee = body.fee.toString();
    if (body.tax !== undefined) updateData.tax = body.tax.toString();
    if (body.note !== undefined) updateData.note = body.note;

    const transaction = await prisma.transaction.update({
      where: { id },
      data: updateData,
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
    console.error("Transaction update error:", error);
    
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

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getCurrentUser(req);
    const { id } = params;

    // 验证交易记录存在且用户有权限
    const transaction = await prisma.transaction.findFirst({
      where: { 
        id,
        account: { userId }
      }
    });

    if (!transaction) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "交易记录不存在" } },
        { status: 404 }
      );
    }

    await prisma.transaction.delete({
      where: { id }
    });

    return NextResponse.json({ 
      success: true,
      data: { message: "交易记录已删除" }
    });

  } catch (error) {
    console.error("Transaction delete error:", error);
    
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