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

// 数据验证模式 - 移除city字段，长期现金与城市无关
const createLongTermCashSchema = z.object({
  totalAmount: z.number().positive(),
  effectiveDate: z.string(), // YYYY-MM-DD
  currency: z.string().optional(),
});

// 业务逻辑处理器
async function createLongTermCash(
  { userId }: ApiContext,
  data: z.infer<typeof createLongTermCashSchema>,
) {
  const record = await prisma.longTermCash.create({
    data: {
      userId,
      totalAmount: data.totalAmount.toString(),
      effectiveDate: new Date(data.effectiveDate),
      currency: data.currency || "CNY",
    },
  });

  return successResponse({ id: record.id });
}

async function getLongTermCash({ userId, req }: ApiContext) {
  const { searchParams } = new URL(req.url);
  const { page, pageSize, skip } = parsePaginationParams(searchParams);

  // 不再按城市过滤，因为长期现金与城市无关
  const where = { userId };

  const [total, records] = await Promise.all([
    prisma.longTermCash.count({ where }),
    prisma.longTermCash.findMany({
      where,
      orderBy: { effectiveDate: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  return buildPaginatedResponse(records, total, page, pageSize);
}

async function deleteLongTermCash({ userId }: ApiContext, id: string) {
  // 验证所有权
  const hasOwnership = await ensureOwnership(prisma, "longTermCash", id, userId);
  if (!hasOwnership) {
    return errorResponse("NOT_FOUND", "长期现金计划不存在");
  }

  await prisma.longTermCash.delete({
    where: { id },
  });

  return successResponse({ message: "长期现金计划已删除" });
}

// API路由处理器
export const POST = withApiHandler(withValidation(createLongTermCashSchema)(createLongTermCash));

export const GET = withApiHandler(getLongTermCash);

export const DELETE = withApiHandler(async (context: ApiContext) => {
  const { searchParams } = new URL(context.req.url);
  const id = searchParams.get("id");

  if (!id) {
    return errorResponse("VALIDATION_ERROR", "缺少长期现金计划ID");
  }

  return deleteLongTermCash(context, id);
});
