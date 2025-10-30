import { type NextRequest, NextResponse } from "next/server";

/**
 * GET /api/v1/identity/countries
 * - 获取支持的国家列表
 * - 返回: Country[]
 */
export async function GET(_req: NextRequest) {
  try {
    // 预定义的国家列表，包含税制和社保信息
    const countries = [
      {
        code: "CN",
        name: "中国",
        nameEn: "China",
        currency: "CNY",
        hasTaxSystem: true,
        hasSocialSecurity: true,
        hasHousingFund: true,
        timezones: ["Asia/Shanghai"],
        description: "完整的税制、社保、公积金体系",
      },
      {
        code: "US",
        name: "美国",
        nameEn: "United States",
        currency: "USD",
        hasTaxSystem: true,
        hasSocialSecurity: true,
        hasHousingFund: false,
        timezones: [
          "America/New_York",
          "America/Los_Angeles",
          "America/Chicago",
          "America/Denver",
        ],
        description: "联邦税制、州税、社会保险",
      },
      {
        code: "UK",
        name: "英国",
        nameEn: "United Kingdom",
        currency: "GBP",
        hasTaxSystem: true,
        hasSocialSecurity: true,
        hasHousingFund: false,
        timezones: ["Europe/London"],
        description: "英国税制、国民保险",
      },
      {
        code: "JP",
        name: "日本",
        nameEn: "Japan",
        currency: "JPY",
        hasTaxSystem: true,
        hasSocialSecurity: true,
        hasHousingFund: false,
        timezones: ["Asia/Tokyo"],
        description: "日本税制、社会保险",
      },
      {
        code: "SG",
        name: "新加坡",
        nameEn: "Singapore",
        currency: "SGD",
        hasTaxSystem: true,
        hasSocialSecurity: true,
        hasHousingFund: false,
        timezones: ["Asia/Singapore"],
        description: "新加坡税制、CPF公积金",
      },
      {
        code: "HK",
        name: "香港",
        nameEn: "Hong Kong",
        currency: "HKD",
        hasTaxSystem: true,
        hasSocialSecurity: false,
        hasHousingFund: false,
        timezones: ["Asia/Hong_Kong"],
        description: "香港税制、MPF强积金",
      },
    ];

    return NextResponse.json(countries);
  } catch (error) {
    console.error("Get countries error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
