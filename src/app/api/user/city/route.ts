import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getUserCityAtDate, updateUserCity } from "@/lib/user-city";

// Schema for updating user city
const updateCitySchema = z.object({
  city: z.string().min(1, "城市名称不能为空"),
  effectiveFrom: z.string().transform((str) => new Date(str)),
  note: z.string().optional(),
});

// GET - 获取用户当前城市和城市历史
export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUser(req);

    // 获取用户基本信息和当前城市
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { currentCity: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "用户不存在" }, { status: 404 });
    }

    // 获取用户的城市历史记录
    const cityHistory = await prisma.userCityHistory.findMany({
      where: { userId },
      orderBy: { effectiveFrom: "desc" },
    });

    // 获取用户当前实际生效的城市（基于时间查询）
    const currentEffectiveCity = await getUserCityAtDate(userId, new Date());

    return NextResponse.json({
      success: true,
      data: {
        currentCity: user.currentCity,
        currentEffectiveCity,
        cityHistory: cityHistory.map((entry) => ({
          id: entry.id,
          city: entry.city,
          effectiveFrom: entry.effectiveFrom.toISOString(),
          effectiveTo: entry.effectiveTo?.toISOString() || null,
          note: entry.note,
          createdAt: entry.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error("City management GET error:", error);

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    return NextResponse.json({ success: false, error: "服务器内部错误" }, { status: 500 });
  }
}

// POST - 更新用户城市
export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUser(req);
    const body = updateCitySchema.parse(await req.json());

    // 使用用户城市管理函数更新城市
    await updateUserCity(userId, body.city, body.effectiveFrom, body.note);

    return NextResponse.json({
      success: true,
      message: "城市更新成功",
    });
  } catch (error) {
    console.error("City management POST error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "数据验证失败",
          details: error.issues.map((issue) => issue.message),
        },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "服务器内部错误" },
      { status: 500 },
    );
  }
}
