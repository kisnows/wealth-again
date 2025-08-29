import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";
import { getUserFromRequest } from "@/server/utils/auth";
import { logAudit } from "@/server/services/audit";

/**
 * PATCH /api/v1/user/profile
 * - 更新用户基础信息
 * - 入参: { baseCurrency?: string, currentCityId?: string, name?: string }
 * - 返回: 更新后的用户信息
 */
export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const data = await req.json();
    const { baseCurrency, currentCityId, name } = data;

    // 验证输入
    const updateData: any = {};
    if (baseCurrency) {
      // 验证币种格式
      if (!/^[A-Z]{3}$/.test(baseCurrency)) {
        return NextResponse.json(
          { error: "Invalid currency format. Must be 3 uppercase letters." },
          { status: 400 }
        );
      }
      updateData.baseCurrency = baseCurrency;
    }

    if (currentCityId) {
      // 验证城市是否存在
      const city = await prisma.city.findUnique({
        where: { id: currentCityId },
      });
      if (!city) {
        return NextResponse.json({ error: "City not found" }, { status: 404 });
      }
      updateData.currentCityId = currentCityId;
    }

    if (name !== undefined) {
      updateData.name = name;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // 更新用户信息
    const updatedUser = await prisma.user.update({
      where: { id: (user as any).id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        baseCurrency: true,
        currentCityId: true,
      },
    });

    // 记录审计日志
    await logAudit("USER_PROFILE_UPDATE", {
      userId: (user as any).id,
      meta: updateData,
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Update user profile error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
