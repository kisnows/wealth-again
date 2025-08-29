import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";
import { getUserFromRequest } from "@/server/utils/auth";
import { logAudit } from "@/server/services/audit";

/**
 * GET /api/v1/city-changes
 * - 获取当前用户的城市变更记录
 * - 返回: Array<CityChangeRecord>
 */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    console.log("Getting city changes for user:", (user as any).id);

    const cityChanges = await prisma.cityChangeRecord.findMany({
      where: { userId: (user as any).id },
      include: {
        toCity: {
          select: { id: true, name: true, country: true },
        },
      },
      orderBy: { changeDate: "desc" },
    });

    return NextResponse.json(cityChanges);
  } catch (error) {
    console.error("Get city changes error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/city-changes
 * - 添加城市变更记录
 * - 入参: { toCityId: string, changeDate: string, reason?: string }
 * - 返回: 创建的记录
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const data = await req.json();
    const { toCityId, changeDate, reason } = data;

    if (!toCityId || !changeDate) {
      return NextResponse.json(
        { error: "toCityId and changeDate are required" },
        { status: 400 }
      );
    }

    // 验证城市是否存在
    const city = await prisma.city.findUnique({
      where: { id: toCityId },
    });
    if (!city) {
      return NextResponse.json({ error: "City not found" }, { status: 404 });
    }

    // 创建城市变更记录
    const cityChange = await prisma.cityChangeRecord.create({
      data: {
        userId: (user as any).id,
        toCityId,
        changeDate: new Date(changeDate),
        reason: reason || null,
      },
      include: {
        toCity: {
          select: { id: true, name: true, country: true },
        },
      },
    });

    // 记录审计日志
    await logAudit("CITY_CHANGE_CREATE", {
      userId: (user as any).id,
      meta: { cityChangeId: cityChange.id, toCityId, changeDate, reason },
    });

    return NextResponse.json(cityChange, { status: 201 });
  } catch (error) {
    console.error("Create city change error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
