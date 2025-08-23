import { NextRequest } from "next/server";
import { z } from "zod";
import {
  type ApiContext,
  buildPaginatedResponse,
  errorResponse,
  parsePaginationParams,
  successResponse,
  withApiHandler,
  withValidation,
} from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

// 数据验证模式
const createTransactionSchema = z.object({
  accountId: z.string().uuid(),
  type: z.enum(["DEPOSIT", "WITHDRAW", "TRANSFER_IN", "TRANSFER_OUT"]),
  tradeDate: z.string(),
  cashAmount: z.number(),
  currency: z.string().default("CNY"),
  note: z.string().optional(),
});

// 业务逻辑处理器
async function createTransaction(
  { userId }: ApiContext,
  data: z.infer<typeof createTransactionSchema>,
) {
  // 验证账户所有权
  const account = await prisma.account.findFirst({
    where: { id: data.accountId, userId },
  });

  if (!account) {
    return errorResponse("FORBIDDEN", "无权访问此账户");
  }

  // 使用事务确保数据一致性
  const result = await prisma.$transaction(async (tx) => {
    // 创建交易记录
    const transaction = await tx.transaction.create({
      data: {
        accountId: data.accountId,
        type: data.type,
        tradeDate: new Date(data.tradeDate),
        amount: data.cashAmount.toString(),
        currency: data.currency,
        note: data.note,
      },
    });

    // 更新账户的累计存款/取款金额
    const updateData: any = {};

    if (data.type === "DEPOSIT" || data.type === "TRANSFER_IN") {
      updateData.totalDeposits = {
        increment: data.cashAmount,
      };
    } else if (data.type === "WITHDRAW" || data.type === "TRANSFER_OUT") {
      updateData.totalWithdrawals = {
        increment: data.cashAmount,
      };
    }

    if (Object.keys(updateData).length > 0) {
      await tx.account.update({
        where: { id: data.accountId },
        data: updateData,
      });
    }

    return transaction;
  });

  return successResponse({ id: result.id });
}

async function getTransactions({ userId, req }: ApiContext) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId");
  const type = searchParams.get("type");
  const { page, pageSize, skip } = parsePaginationParams(searchParams);

  // 构建查询条件
  const where: any = {};

  if (accountId) {
    // 验证账户所有权
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) {
      return errorResponse("FORBIDDEN", "无权访问此账户");
    }

    where.accountId = accountId;
  } else {
    // 如果不指定账户，则查询用户所有账户的交易
    const userAccounts = await prisma.account.findMany({
      where: { userId },
      select: { id: true },
    });

    where.accountId = {
      in: userAccounts.map((acc) => acc.id),
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
    }),
  ]);

  return buildPaginatedResponse(transactions, total, page, pageSize);
}

// API路由处理器
export const POST = withApiHandler(withValidation(createTransactionSchema)(createTransaction));

export const GET = withApiHandler(getTransactions);
