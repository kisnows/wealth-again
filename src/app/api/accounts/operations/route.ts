import { NextRequest } from "next/server";
import { z } from "zod";
import {
  type ApiContext,
  ensureOwnership,
  errorResponse,
  successResponse,
  withApiHandler,
  withValidation,
} from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

// 数据验证模式
const transactionSchema = z.object({
  accountId: z.string().min(1, "账户ID不能为空"),
  type: z.enum(["DEPOSIT", "WITHDRAW"], {
    message: "交易类型必须是存款(DEPOSIT)或取款(WITHDRAW)",
  }),
  amount: z.number().positive("金额必须大于0"),
  currency: z.string().optional(), // 如果不提供，使用账户基础货币
  note: z.string().optional(),
});

const transferSchema = z.object({
  fromAccountId: z.string().min(1, "转出账户ID不能为空"),
  toAccountId: z.string().min(1, "转入账户ID不能为空"),
  amount: z.number().positive("转账金额必须大于0"),
  note: z.string().optional(),
});

const valuationSchema = z.object({
  accountId: z.string().min(1, "账户ID不能为空"),
  totalValue: z.number().nonnegative("估值不能为负数"),
  note: z.string().optional(),
});

// 存取款业务逻辑
async function processTransaction({ userId }: ApiContext, data: z.infer<typeof transactionSchema>) {
  // 验证账户所有权
  const account = await prisma.account.findFirst({
    where: { id: data.accountId, userId },
  });

  if (!account) {
    return errorResponse("NOT_FOUND", "账户不存在或无权限访问");
  }

  // 使用账户基础货币如果未指定
  const currency = data.currency || account.baseCurrency;

  // 根据账户类型验证操作
  if (account.accountType === "LOAN" && data.type === "DEPOSIT") {
    return errorResponse(
      "INVALID_OPERATION",
      "借贷账户的存款操作应该是还款，请使用取款操作来减少负债",
    );
  }

  // 使用事务处理
  const result = await prisma.$transaction(async (tx) => {
    // 创建交易记录
    const transaction = await tx.transaction.create({
      data: {
        accountId: data.accountId,
        type: data.type,
        tradeDate: new Date(),
        amount: data.amount.toString(),
        currency,
        note: data.note,
      },
    });

    // 更新账户统计
    const updateData: any = {};
    if (data.type === "DEPOSIT") {
      updateData.totalDeposits = {
        increment: data.amount,
      };
    } else {
      updateData.totalWithdrawals = {
        increment: data.amount,
      };
    }

    const updatedAccount = await tx.account.update({
      where: { id: data.accountId },
      data: updateData,
    });

    // 如果是储蓄账户，自动更新估值快照（估值 = 本金）
    if (account.accountType === "SAVINGS") {
      const newBalance =
        Number(account.initialBalance) +
        (Number(updatedAccount.totalDeposits) - Number(updatedAccount.totalWithdrawals));

      await tx.valuationSnapshot.create({
        data: {
          accountId: data.accountId,
          asOf: new Date(),
          totalValue: newBalance.toString(),
        },
      });
    }

    return { transaction, account: updatedAccount };
  });

  return successResponse(result);
}

// 转账业务逻辑
async function processTransfer({ userId }: ApiContext, data: z.infer<typeof transferSchema>) {
  // 验证两个账户的所有权
  const [fromAccount, toAccount] = await Promise.all([
    prisma.account.findFirst({ where: { id: data.fromAccountId, userId } }),
    prisma.account.findFirst({ where: { id: data.toAccountId, userId } }),
  ]);

  if (!fromAccount) {
    return errorResponse("NOT_FOUND", "转出账户不存在或无权限访问");
  }

  if (!toAccount) {
    return errorResponse("NOT_FOUND", "转入账户不存在或无权限访问");
  }

  if (fromAccount.id === toAccount.id) {
    return errorResponse("INVALID_OPERATION", "不能向同一账户转账");
  }

  // 使用事务处理转账
  const result = await prisma.$transaction(async (tx) => {
    const transferId = crypto.randomUUID();
    const fromAmount = data.amount;
    let toAmount = data.amount;
    let exchangeRate: number | undefined;

    // 如果是跨币种转账，需要汇率转换
    if (fromAccount.baseCurrency !== toAccount.baseCurrency) {
      // 这里简化处理，实际应该调用汇率API
      // 以USD为中间价转换：fromCurrency -> USD -> toCurrency
      if (fromAccount.baseCurrency === "USD") {
        // USD -> 其他币种，假设汇率
        const usdToTargetRate =
          toAccount.baseCurrency === "CNY" ? 7.2 : toAccount.baseCurrency === "HKD" ? 7.8 : 1;
        toAmount = data.amount * usdToTargetRate;
        exchangeRate = usdToTargetRate;
      } else if (toAccount.baseCurrency === "USD") {
        // 其他币种 -> USD
        const sourceToUsdRate =
          fromAccount.baseCurrency === "CNY" ? 0.14 : fromAccount.baseCurrency === "HKD" ? 0.13 : 1;
        toAmount = data.amount * sourceToUsdRate;
        exchangeRate = sourceToUsdRate;
      } else {
        // 非USD的跨币种转账，先转USD再转目标币种
        const sourceToUsdRate = fromAccount.baseCurrency === "CNY" ? 0.14 : 0.13;
        const usdToTargetRate = toAccount.baseCurrency === "CNY" ? 7.2 : 7.8;
        toAmount = data.amount * sourceToUsdRate * usdToTargetRate;
        exchangeRate = sourceToUsdRate * usdToTargetRate;
      }
    }

    // 创建转出记录
    const transferOut = await tx.transaction.create({
      data: {
        accountId: data.fromAccountId,
        type: "TRANSFER_OUT",
        tradeDate: new Date(),
        amount: fromAmount.toString(),
        currency: fromAccount.baseCurrency,
        relatedTransfer: transferId,
        exchangeRate: exchangeRate?.toString(),
        note: data.note,
      },
    });

    // 创建转入记录
    const transferIn = await tx.transaction.create({
      data: {
        accountId: data.toAccountId,
        type: "TRANSFER_IN",
        tradeDate: new Date(),
        amount: toAmount.toString(),
        currency: toAccount.baseCurrency,
        relatedTransfer: transferId,
        exchangeRate: exchangeRate?.toString(),
        note: data.note,
      },
    });

    // 更新转出账户统计
    const updatedFromAccount = await tx.account.update({
      where: { id: data.fromAccountId },
      data: {
        totalWithdrawals: {
          increment: fromAmount,
        },
      },
    });

    // 更新转入账户统计
    const updatedToAccount = await tx.account.update({
      where: { id: data.toAccountId },
      data: {
        totalDeposits: {
          increment: toAmount,
        },
      },
    });

    // 如果涉及储蓄账户，自动更新估值
    if (fromAccount.accountType === "SAVINGS") {
      const fromBalance =
        Number(fromAccount.initialBalance) +
        Number(updatedFromAccount.totalDeposits) -
        Number(updatedFromAccount.totalWithdrawals);

      await tx.valuationSnapshot.create({
        data: {
          accountId: data.fromAccountId,
          asOf: new Date(),
          totalValue: fromBalance.toString(),
        },
      });
    }

    if (toAccount.accountType === "SAVINGS") {
      const toBalance =
        Number(toAccount.initialBalance) +
        Number(updatedToAccount.totalDeposits) -
        Number(updatedToAccount.totalWithdrawals);

      await tx.valuationSnapshot.create({
        data: {
          accountId: data.toAccountId,
          asOf: new Date(),
          totalValue: toBalance.toString(),
        },
      });
    }

    return {
      transferId,
      transferOut,
      transferIn,
      fromAccount: updatedFromAccount,
      toAccount: updatedToAccount,
      exchangeRate,
    };
  });

  return successResponse(result);
}

// 估值更新业务逻辑
async function updateValuation({ userId }: ApiContext, data: z.infer<typeof valuationSchema>) {
  // 验证账户所有权
  const account = await prisma.account.findFirst({
    where: { id: data.accountId, userId },
  });

  if (!account) {
    return errorResponse("NOT_FOUND", "账户不存在或无权限访问");
  }

  // 储蓄账户不允许手动设置估值
  if (account.accountType === "SAVINGS") {
    return errorResponse("INVALID_OPERATION", "储蓄账户的估值会自动等于本金，无需手动设置");
  }

  // 创建估值快照
  const snapshot = await prisma.valuationSnapshot.create({
    data: {
      accountId: data.accountId,
      asOf: new Date(),
      totalValue: data.totalValue.toString(),
    },
  });

  return successResponse(snapshot);
}

// API路由处理器
export const POST = withApiHandler(async (context: ApiContext) => {
  const { searchParams } = new URL(context.req.url);
  const action = searchParams.get("action");

  if (!action) {
    return errorResponse("VALIDATION_ERROR", "缺少操作类型参数");
  }

  const body = await context.req.json();

  switch (action) {
    case "transaction": {
      const transactionData = transactionSchema.parse(body);
      return processTransaction(context, transactionData);
    }

    case "transfer": {
      const transferData = transferSchema.parse(body);
      return processTransfer(context, transferData);
    }

    case "valuation": {
      const valuationData = valuationSchema.parse(body);
      return updateValuation(context, valuationData);
    }

    default:
      return errorResponse("INVALID_ACTION", "无效的操作类型");
  }
});
