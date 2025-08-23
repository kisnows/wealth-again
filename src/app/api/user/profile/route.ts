import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  withApiHandler,
  withValidation,
  successResponse,
  errorResponse,
  ApiContext,
} from "@/lib/api-handler";

// 数据验证模式
const updateProfileSchema = z.object({
  baseCurrency: z.string().optional(),
});

// 业务逻辑处理器
async function getUserProfile({ userId }: ApiContext) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return errorResponse("NOT_FOUND", "用户不存在");
  }

  return successResponse({
    id: user.id,
    email: user.email,
    name: user.name,
    baseCurrency: user.baseCurrency,
  });
}

async function updateUserProfile(
  { userId }: ApiContext,
  data: z.infer<typeof updateProfileSchema>
) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      baseCurrency: data.baseCurrency,
    },
  });

  return successResponse({
    id: user.id,
    email: user.email,
    name: user.name,
    baseCurrency: user.baseCurrency,
  });
}

// API路由处理器
export const GET = withApiHandler(getUserProfile);

export const PUT = withApiHandler(
  withValidation(updateProfileSchema)(updateUserProfile)
);