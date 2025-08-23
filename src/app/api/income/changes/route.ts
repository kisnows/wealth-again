import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  withApiHandler,
  withValidation,
  successResponse,
  errorResponse,
  parsePaginationParams,
  buildPaginatedResponse,
  ensureOwnership,
  ApiContext,
} from "@/lib/api-handler";

// 数据验证模式 - 移除city字段，收入变更与城市无关
const createIncomeChangeSchema = z.object({
  grossMonthly: z.number().positive(),
  effectiveFrom: z.string(),
  currency: z.string().optional(),
});

// 业务逻辑处理器
async function createIncomeChange(
  { userId }: ApiContext,
  data: z.infer<typeof createIncomeChangeSchema>
) {
  const record = await prisma.incomeChange.create({
    data: {
      userId,
      grossMonthly: data.grossMonthly.toString(),
      effectiveFrom: new Date(data.effectiveFrom),
      currency: data.currency || "CNY",
    },
  });

  return successResponse({ id: record.id });
}

async function getIncomeChanges({ userId, req }: ApiContext) {
  const { searchParams } = new URL(req.url);
  const { page, pageSize, skip } = parsePaginationParams(searchParams);

  // 不再按城市过滤，因为收入变更与城市无关
  const [total, records] = await Promise.all([
    prisma.incomeChange.count({ where: { userId } }),
    prisma.incomeChange.findMany({
      where: { userId },
      orderBy: { effectiveFrom: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  return buildPaginatedResponse(records, total, page, pageSize);
}

async function deleteIncomeChange({ userId }: ApiContext, id: string) {
  // 验证所有权
  const hasOwnership = await ensureOwnership(prisma, "incomeChange", id, userId);
  if (!hasOwnership) {
    return errorResponse("NOT_FOUND", "收入变更记录不存在");
  }

  await prisma.incomeChange.delete({
    where: { id },
  });

  return successResponse({ message: "收入变更记录已删除" });
}

// API路由处理器
export const POST = withApiHandler(
  withValidation(createIncomeChangeSchema)(createIncomeChange)
);

export const GET = withApiHandler(getIncomeChanges);

export const DELETE = withApiHandler(async (context: ApiContext) => {
  const { searchParams } = new URL(context.req.url);
  const id = searchParams.get("id");
  
  if (!id) {
    return errorResponse("VALIDATION_ERROR", "缺少收入变更记录ID");
  }

  return deleteIncomeChange(context, id);
});
