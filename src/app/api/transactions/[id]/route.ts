import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

const updateTransactionSchema = z.object({
  type: z.enum(["DEPOSIT", "WITHDRAW", "TRANSFER_IN", "TRANSFER_OUT"]).optional(),
  tradeDate: z.string().optional(),
  cashAmount: z.number().optional(),
  currency: z.string().optional(),
  note: z.string().optional(),
});

type Params = Promise<{ id: string }>;

export async function GET(req: NextRequest, props: { params: Params }) {
  try {
    const userId = await getCurrentUser(req);
    const params = await props.params;
    const { id } = params;

    const transaction = await prisma.transaction.findFirst({
      where: {
        id,
        account: { userId }, // 通过account关联确保用户权限
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "交易记录不存在" } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    console.error("Transaction get error:", error);

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "请先登录" } },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "服务器内部错误" } },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest, props: { params: Params }) {
  try {
    const userId = await getCurrentUser(req);
    const params = await props.params;
    const { id } = params;
    const body = updateTransactionSchema.parse(await req.json());

    // 验证交易记录存在且用户有权限
    const existingTransaction = await prisma.transaction.findFirst({
      where: {
        id,
        account: { userId },
      },
    });

    if (!existingTransaction) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "交易记录不存在" } },
        { status: 404 },
      );
    }

    const updateData: any = {};

    if (body.type !== undefined) updateData.type = body.type;
    if (body.tradeDate !== undefined) updateData.tradeDate = new Date(body.tradeDate);
    if (body.cashAmount !== undefined) updateData.amount = body.cashAmount.toString();
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (body.note !== undefined) updateData.note = body.note;

    const transaction = await prisma.transaction.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    console.error("Transaction update error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: error.issues[0].message } },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "请先登录" } },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "服务器内部错误" } },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, props: { params: Params }) {
  try {
    const userId = await getCurrentUser(req);
    const params = await props.params;
    const { id } = params;

    // 验证交易记录存在且用户有权限
    const transaction = await prisma.transaction.findFirst({
      where: {
        id,
        account: { userId },
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "交易记录不存在" } },
        { status: 404 },
      );
    }

    await prisma.transaction.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      data: { message: "交易记录已删除" },
    });
  } catch (error) {
    console.error("Transaction delete error:", error);

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "请先登录" } },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "服务器内部错误" } },
      { status: 500 },
    );
  }
}
