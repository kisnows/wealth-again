import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createTaxService } from "@/lib/tax";

const taxService = createTaxService(prisma);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city") || "Hangzhou";
  const page = Number(searchParams.get("page") || "1");
  const pageSize = Number(searchParams.get("pageSize") || "10");

  try {
    // 获取税务配置历史记录
    const history = await taxService.getTaxConfigHistory(city, pageSize);
    
    // 整理数据格式
    const socialConfigs = history?.socialConfigs || [];
    const formattedHistory = socialConfigs.map((config: any) => ({
      id: config.id,
      city: config.city,
      effectiveFrom: config.effectiveFrom,
      effectiveTo: config.effectiveTo,
      socialMinBase: Number(config.socialMinBase),
      socialMaxBase: Number(config.socialMaxBase),
      pensionRate: Number(config.pensionRate),
      medicalRate: Number(config.medicalRate),
      unemploymentRate: Number(config.unemploymentRate),
      housingFundMinBase: Number(config.housingFundMinBase),
      housingFundMaxBase: Number(config.housingFundMaxBase),
      housingFundRate: Number(config.housingFundRate),
    }));

    return NextResponse.json({
      city,
      page,
      pageSize,
      total: formattedHistory.length,
      records: formattedHistory,
    });
  } catch (error) {
    console.error("GET /api/config/tax-params/history error:", error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}