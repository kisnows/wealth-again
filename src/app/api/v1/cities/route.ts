import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";
import { logAudit } from "@/server/services/audit";
import { getUserFromRequest } from "@/server/utils/auth";

type SocialSecurityRulePayload = {
  startDate?: string;
  endDate?: string | null;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  currency?: string | null;
  baseMin?: number;
  baseMax?: number;
  ratePension?: number;
  rateMedical?: number;
  rateUnemployment?: number;
  fixedMedicalPersonal?: number | null;
};

type HousingFundRulePayload = {
  startDate?: string;
  endDate?: string | null;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  currency?: string | null;
  baseMin?: number;
  baseMax?: number;
  rateEmployee?: number;
};

type TaxConfigTemplate = {
  config: {
    country: string;
    taxYear: number;
    standardDeduction: number;
    specialAdditionalDeduction: number;
  };
  brackets: Array<{
    position: number;
    threshold: number;
    taxRate: number;
    quickDeduction: number;
  }>;
};

/**
 * GET /api/v1/cities
 * - 获取所有城市列表
 * - 返回: City[]
 */
export async function GET(_req: NextRequest) {
  try {
    const cities = await prisma.city.findMany({
      orderBy: [{ country: "asc" }, { name: "asc" }],
    });

    return NextResponse.json(cities);
  } catch (error) {
    console.error("Get cities error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/v1/cities
 * - 新增城市，并自动配置相关规则
 * - 入参: { name: string, country: string, socialSecurityRules?: object, housingFundRules?: object }
 * - 返回: 创建的城市信息
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || typeof user.id !== "string") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = user.id;

  try {
    const data = await req.json();
    const { name, country, socialSecurityRules, housingFundRules } = data;

    if (!name || !country) {
      return NextResponse.json(
        { error: "Name and country are required" },
        { status: 400 },
      );
    }

    // 检查城市是否已存在
    const existingCity = await prisma.city.findUnique({
      where: { name },
    });

    if (existingCity) {
      return NextResponse.json(
        { error: "City already exists" },
        { status: 409 },
      );
    }

    // 创建城市
    const city = await prisma.city.create({
      data: {
        name,
        country,
      },
    });

    // 自动配置税制（如果国家不存在）
    await ensureTaxConfig(country);

    // 配置社保规则
    if (socialSecurityRules) {
      await createSocialSecurityRule(city.id, socialSecurityRules);
    }

    // 配置公积金规则
    if (housingFundRules) {
      await createHousingFundRule(city.id, housingFundRules);
    }

    // 记录审计日志
    await logAudit("CITY_CREATE", {
      userId,
      meta: { cityId: city.id, name, country },
    });

    return NextResponse.json(city, { status: 201 });
  } catch (error) {
    console.error("Create city error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// 确保税制配置存在
async function ensureTaxConfig(country: string) {
  const currentYear = new Date().getFullYear();

  const existingConfig = await prisma.taxConfig.findUnique({
    where: {
      country_taxYear: { country, taxYear: currentYear },
    },
  });

  if (!existingConfig) {
    // 根据国家创建默认税制配置
    const defaultConfigs = getDefaultTaxConfig(country, currentYear);

    if (defaultConfigs) {
      await prisma.taxConfig.create({
        data: defaultConfigs.config,
      });

      // 创建税率档次
      for (const bracket of defaultConfigs.brackets) {
        await prisma.taxBracket.create({
          data: {
            country,
            taxYear: currentYear,
            currency: defaultConfigs.config.currency,
            effectiveFrom: defaultConfigs.config.effectiveFrom,
            effectiveTo: defaultConfigs.config.effectiveTo,
            position: bracket.position,
            threshold: bracket.threshold,
            taxRate: bracket.taxRate,
            quickDeduction: bracket.quickDeduction,
          },
        });
      }
    }
  }
}

// 创建社保规则
async function createSocialSecurityRule(
  cityId: string,
  rules: SocialSecurityRulePayload,
) {
  const { effectiveFrom, effectiveTo } = resolveEffectiveRange(rules);
  const currency = resolveCurrency(rules.currency);

  await prisma.cityRuleSS.create({
    data: {
      cityId,
      currency,
      effectiveFrom,
      effectiveTo,
      baseMin: rules.baseMin || 0,
      baseMax: rules.baseMax || 999999,
      ratePension: rules.ratePension || 0.08,
      rateMedical: rules.rateMedical || 0.02,
      rateUnemployment: rules.rateUnemployment || 0.005,
      fixedMedicalPersonal: rules.fixedMedicalPersonal || null,
    },
  });
}

// 创建公积金规则
async function createHousingFundRule(
  cityId: string,
  rules: HousingFundRulePayload,
) {
  const { effectiveFrom, effectiveTo } = resolveEffectiveRange(rules);
  const currency = resolveCurrency(rules.currency);

  await prisma.cityRuleHF.create({
    data: {
      cityId,
      currency,
      effectiveFrom,
      effectiveTo,
      baseMin: rules.baseMin || 0,
      baseMax: rules.baseMax || 999999,
      rateEmployee: rules.rateEmployee || 0.12,
    },
  });
}

// 获取默认税制配置
function getDefaultTaxConfig(
  country: string,
  taxYear: number,
): TaxConfigTemplate | undefined {
  const currency = country === "US" ? "USD" : "CNY";
  const effectiveFrom = new Date(Date.UTC(taxYear, 0, 1));
  const effectiveTo: Date | null = null;
  const configs: Record<string, TaxConfigTemplate> = {
    CN: {
      config: {
        country,
        taxYear,
        currency,
        effectiveFrom,
        effectiveTo,
        standardDeduction: 5000,
        specialAdditionalDeduction: 0,
      },
      brackets: [
        { position: 1, threshold: 36000, taxRate: 0.03, quickDeduction: 0 },
        { position: 2, threshold: 144000, taxRate: 0.1, quickDeduction: 2520 },
        { position: 3, threshold: 300000, taxRate: 0.2, quickDeduction: 16920 },
        {
          position: 4,
          threshold: 420000,
          taxRate: 0.25,
          quickDeduction: 31920,
        },
        { position: 5, threshold: 660000, taxRate: 0.3, quickDeduction: 52920 },
        {
          position: 6,
          threshold: 960000,
          taxRate: 0.35,
          quickDeduction: 85920,
        },
        {
          position: 7,
          threshold: 1000000000,
          taxRate: 0.45,
          quickDeduction: 181920,
        },
      ],
    },
    US: {
      config: {
        country,
        taxYear,
        currency,
        effectiveFrom,
        effectiveTo,
        standardDeduction: 13850, // 2023 standard deduction for single filers
        specialAdditionalDeduction: 0,
      },
      brackets: [
        { position: 1, threshold: 11000, taxRate: 0.1, quickDeduction: 0 },
        { position: 2, threshold: 44725, taxRate: 0.12, quickDeduction: 220 },
        { position: 3, threshold: 95375, taxRate: 0.22, quickDeduction: 4690 },
        { position: 4, threshold: 182050, taxRate: 0.24, quickDeduction: 6557 },
        {
          position: 5,
          threshold: 231250,
          taxRate: 0.32,
          quickDeduction: 21085,
        },
        {
          position: 6,
          threshold: 578125,
          taxRate: 0.35,
          quickDeduction: 38665,
        },
        {
          position: 7,
          threshold: 1000000000,
          taxRate: 0.37,
          quickDeduction: 50225,
        },
      ],
    },
    // 可以继续添加其他国家的默认配置
  };

  return configs[country] || null;
}

type RangePayload = {
  startDate?: string;
  endDate?: string | null;
  effectiveFrom?: string;
  effectiveTo?: string | null;
};

function resolveEffectiveRange(
  payload: RangePayload,
): { effectiveFrom: Date; effectiveTo: Date | null } {
  const fromStr = payload.effectiveFrom ?? payload.startDate;
  if (!fromStr) throw new Error("effectiveFrom required");
  const effectiveFrom = new Date(fromStr);
  if (Number.isNaN(effectiveFrom.getTime())) {
    throw new Error("invalid effectiveFrom");
  }
  const toStr =
    payload.effectiveTo !== undefined ? payload.effectiveTo : payload.endDate;
  if (!toStr) return { effectiveFrom, effectiveTo: null };
  const effectiveTo = new Date(toStr);
  if (Number.isNaN(effectiveTo.getTime())) {
    throw new Error("invalid effectiveTo");
  }
  return { effectiveFrom, effectiveTo };
}

function resolveCurrency(currency?: string | null): string {
  if (!currency) return "CNY";
  const code = currency.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : "CNY";
}
