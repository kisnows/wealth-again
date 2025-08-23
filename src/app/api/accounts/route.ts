import { NextRequest } from "next/server";
import { z } from "zod";
import {
  type ApiContext,
  buildPaginatedResponse,
  ensureOwnership,
  errorResponse,
  parsePaginationParams,
  successResponse,
  withApiHandler,
  withValidation,
} from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

// 数据验证模式
const createAccountSchema = z.object({
  name: z.string().min(1, "账户名称不能为空"),
  accountType: z.enum(["SAVINGS", "INVESTMENT", "LOAN"]).default("INVESTMENT"),
  subType: z.string().optional(),
  description: z.string().optional(),
  baseCurrency: z.string().default("CNY"),
  initialBalance: z.number().default(0),
});

// 业务逻辑处理器
async function createAccount({ userId }: ApiContext, data: z.infer<typeof createAccountSchema>) {
  // 检查同名账户
  const exists = await prisma.account.findFirst({
    where: { userId, name: data.name },
    select: { id: true },
  });

  if (exists) {
    return errorResponse("DUPLICATE_NAME", "账户名已存在");
  }

  // 使用事务创建账户和初始资金记录
  const account = await prisma.$transaction(async (tx) => {
    const initialDeposit = data.initialBalance > 0 ? data.initialBalance : 0;

    // 创建账户
    const newAccount = await tx.account.create({
      data: {
        name: data.name,
        accountType: data.accountType,
        subType: data.subType,
        description: data.description,
        baseCurrency: data.baseCurrency,
        initialBalance: initialDeposit.toString(),
        totalDeposits: initialDeposit.toString(),
        userId,
      },
    });

    // 如果有初始资金，创建一个快照记录
    if (initialDeposit > 0) {
      const now = new Date();
      await tx.valuationSnapshot.create({
        data: {
          accountId: newAccount.id,
          asOf: now,
          totalValue: initialDeposit.toString(),
        },
      });
    }

    return newAccount;
  });

  return successResponse(account);
}

async function getAccounts({ userId, req }: ApiContext) {
  const { searchParams } = new URL(req.url);
  const { page, pageSize, skip } = parsePaginationParams(searchParams);
  const status = searchParams.get("status") || "ACTIVE";

  const [total, accounts] = await Promise.all([
    prisma.account.count({ where: { userId, status } }),
    prisma.account.findMany({
      where: { userId, status },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        _count: {
          select: {
            transactions: true,
            snapshots: true,
          },
        },
        snapshots: {
          orderBy: { asOf: "desc" },
          take: 1, // 只获取最新的估值快照
        },
      },
    }),
  ]);

  // 为每个账户添加当前市值信息
  const enrichedAccounts = accounts.map((account) => {
    const latestSnapshot = account.snapshots[0];
    const currentValue = latestSnapshot ? Number(latestSnapshot.totalValue) : null;

    return {
      ...account,
      currentValue,
      snapshots: undefined, // 不返回快照数据到前端
    };
  });

  return buildPaginatedResponse(enrichedAccounts, total, page, pageSize);
}

async function deleteAccount({ userId }: ApiContext, id: string) {
  // 验证所有权
  const hasOwnership = await ensureOwnership(prisma, "account", id, userId);
  if (!hasOwnership) {
    return errorResponse("NOT_FOUND", "账户不存在");
  }

  // 检查是否有交易记录
  const transactionCount = await prisma.transaction.count({
    where: { accountId: id },
  });

  if (transactionCount > 0) {
    return errorResponse("HAS_TRANSACTIONS", "该账户有交易记录，请先归档而不是删除");
  }

  // 删除相关数据（级联删除）
  await prisma.$transaction(async (tx) => {
    await tx.valuationSnapshot.deleteMany({ where: { accountId: id } });
    await tx.account.delete({ where: { id } });
  });

  return successResponse({ message: "账户已删除" });
}

// API路由处理器
export const POST = withApiHandler(withValidation(createAccountSchema)(createAccount));

export const GET = withApiHandler(getAccounts);

export const DELETE = withApiHandler(async (context: ApiContext) => {
  const { searchParams } = new URL(context.req.url);
  const id = searchParams.get("id");

  if (!id) {
    return errorResponse("VALIDATION_ERROR", "缺少账户ID");
  }

  return deleteAccount(context, id);
});
