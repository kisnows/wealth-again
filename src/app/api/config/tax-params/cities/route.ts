import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    // 获取所有有税务配置的城市
    const [taxCities, socialCities] = await Promise.all([
      prisma.taxBracket.groupBy({
        by: ['city'],
        where: {
          effectiveFrom: { lte: new Date() },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: new Date() } }
          ]
        }
      }),
      prisma.socialInsuranceConfig.groupBy({
        by: ['city'],
        where: {
          effectiveFrom: { lte: new Date() },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: new Date() } }
          ]
        }
      })
    ]);

    // 获取两个集合的交集（同时有税率和社保配置的城市）
    const taxCitySet = new Set(taxCities.map(item => item.city));
    const cities = socialCities
      .map(item => item.city)
      .filter(city => taxCitySet.has(city))
      .sort();

    return NextResponse.json({ cities });
  } catch (error) {
    console.error("GET /api/config/tax-params/cities error:", error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}