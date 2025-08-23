import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { calculateAccountPerformance, calculateTimeWeightedReturn } from "@/lib/performance";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

type Params = Promise<{ id: string }>;

// 数据验证模式
const updateAccountSchema = z.object({
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  name: z.string().min(1).optional(),
  subType: z.string().optional(),
  description: z.string().optional(),
});

export async function GET(req: NextRequest, props: { params: Params }) {
  try {
    const userId = await getCurrentUser(req);
    const params = await props.params;
    const accountId = params.id;

    // 验证账户所有权
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId },
      include: {
        transactions: {
          orderBy: { tradeDate: "asc" },
        },
        snapshots: {
          orderBy: { asOf: "desc" },
          take: 10, // 只获取最近10个快照用于图表展示
        },
      },
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "账户不存在或无权限访问" } },
        { status: 404 },
      );
    }

    // 计算投资绩效
    const performance = await calculateAccountPerformance(prisma, accountId);

    // 计算时间加权收益率
    const twr = await calculateTimeWeightedReturn(prisma, accountId);

    // 计算账户统计信息
    const totalDeposits = account.transactions
      .filter((t) => Number(t.amount) > 0)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalWithdrawals = account.transactions
      .filter((t) => Number(t.amount) < 0)
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

    return NextResponse.json({
      success: true,
      data: {
        account: {
          id: account.id,
          name: account.name,
          accountType: account.accountType,
          subType: account.subType,
          description: account.description,
          baseCurrency: account.baseCurrency,
          status: account.status,
          initialBalance: Number(account.initialBalance),
          totalDeposits,
          totalWithdrawals,
          createdAt: account.createdAt,
        },
        performance,
        twr,
        snapshots: account.snapshots.map((s) => ({
          id: s.id,
          asOf: s.asOf,
          totalValue: Number(s.totalValue),
        })),
      },
    });
  } catch (error) {
    console.error("Account detail error:", error);

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

export async function PATCH(req: NextRequest, props: { params: Params }) {
  try {
    const userId = await getCurrentUser(req);
    const params = await props.params;
    const accountId = params.id;
    const body = await req.json();

    // 验证输入数据
    const validatedData = updateAccountSchema.parse(body);

    // 验证账户所有权
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "账户不存在或无权限访问" } },
        { status: 404 },
      );
    }

    // 更新账户信息
    const updatedAccount = await prisma.account.update({
      where: { id: accountId },
      data: validatedData,
      include: {
        _count: {
          select: {
            transactions: true,
            snapshots: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedAccount,
    });
  } catch (error) {
    console.error("Account patch error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "输入数据格式错误", details: error.issues },
        },
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

export async function PUT(req: NextRequest, props: { params: Params }) {
  try {
    const userId = await getCurrentUser(req);
    const params = await props.params;
    const accountId = params.id;
    const body = await req.json();

    // 验证账户所有权
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "账户不存在或无权限访问" } },
        { status: 404 },
      );
    }

    // 更新账户信息
    const updatedAccount = await prisma.account.update({
      where: { id: accountId },
      data: {
        name: body.name,
        baseCurrency: body.baseCurrency,
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedAccount,
    });
  } catch (error) {
    console.error("Account update error:", error);

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
