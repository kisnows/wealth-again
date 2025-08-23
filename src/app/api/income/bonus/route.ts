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
import { endOfMonth, parseYMD } from "@/lib/date";
import { prisma } from "@/lib/prisma";

// 数据验证模式 - 移除city字段，奖金与城市无关
const createBonusSchema = z.object({
  amount: z.number().positive(),
  effectiveDate: z.string(), // YYYY-MM-DD
  currency: z.string().optional(),
});

// 业务逻辑处理器
async function createBonus({ userId }: ApiContext, data: z.infer<typeof createBonusSchema>) {
  const record = await prisma.bonusPlan.create({
    data: {
      userId,
      amount: data.amount.toString(),
      currency: data.currency || "CNY",
      // 规则：按自然月最后一天生效；为避免时区导致 ISO 日期回退，设置到当天中午
      effectiveDate: (() => {
        const d = endOfMonth(parseYMD(data.effectiveDate));
        d.setHours(12, 0, 0, 0);
        return d;
      })(),
    },
  });

  return successResponse({ id: record.id });
}

async function getBonuses({ userId, req }: ApiContext) {
  const { searchParams } = new URL(req.url);
  const { page, pageSize, skip } = parsePaginationParams(searchParams);

  // 不再按城市过滤，因为奖金与城市无关
  const where = { userId };

  const [total, records] = await Promise.all([
    prisma.bonusPlan.count({ where }),
    prisma.bonusPlan.findMany({
      where,
      orderBy: { effectiveDate: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  return buildPaginatedResponse(records, total, page, pageSize);
}

async function deleteBonus({ userId }: ApiContext, id: string) {
  // 验证所有权
  const hasOwnership = await ensureOwnership(prisma, "bonusPlan", id, userId);
  if (!hasOwnership) {
    return errorResponse("NOT_FOUND", "奖金计划不存在");
  }

  await prisma.bonusPlan.delete({
    where: { id },
  });

  return successResponse({ message: "奖金计划已删除" });
}

// API路由处理器
export const POST = withApiHandler(withValidation(createBonusSchema)(createBonus));

export const GET = withApiHandler(getBonuses);

export const DELETE = withApiHandler(async (context: ApiContext) => {
  const { searchParams } = new URL(context.req.url);
  const id = searchParams.get("id");

  if (!id) {
    return errorResponse("VALIDATION_ERROR", "缺少奖金计划ID");
  }

  return deleteBonus(context, id);
});
