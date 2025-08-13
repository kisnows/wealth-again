import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedTaxData() {
  console.log("开始初始化税务数据...");

  // 删除现有数据
  await prisma.taxBracket.deleteMany();
  await prisma.socialInsuranceConfig.deleteMany();

  // 2025年个人所得税税率表（全国通用）
  const taxBrackets = [
    { minIncome: 0, maxIncome: 36000, taxRate: 0.03, quickDeduction: 0 },
    { minIncome: 36000, maxIncome: 144000, taxRate: 0.1, quickDeduction: 2520 },
    {
      minIncome: 144000,
      maxIncome: 300000,
      taxRate: 0.2,
      quickDeduction: 16920,
    },
    {
      minIncome: 300000,
      maxIncome: 420000,
      taxRate: 0.25,
      quickDeduction: 31920,
    },
    {
      minIncome: 420000,
      maxIncome: 660000,
      taxRate: 0.3,
      quickDeduction: 52920,
    },
    {
      minIncome: 660000,
      maxIncome: 960000,
      taxRate: 0.35,
      quickDeduction: 85920,
    },
    {
      minIncome: 960000,
      maxIncome: null,
      taxRate: 0.45,
      quickDeduction: 181920,
    },
  ];

  // 杭州社保公积金配置（2025年）
  const hangzhouSocialConfig = {
    city: "Hangzhou",
    socialMinBase: 4812,
    socialMaxBase: 24930,
    pensionRate: 0.08,
    medicalRate: 0.02,
    unemploymentRate: 0.005,
    housingFundMinBase: 4812,
    housingFundMaxBase: 40694,
    housingFundRate: 0.12,
    effectiveFrom: new Date("2025-01-01"),
    effectiveTo: null,
  };

  // 创建税率档次（杭州）
  for (const bracket of taxBrackets) {
    await prisma.taxBracket.create({
      data: {
        city: "Hangzhou",
        minIncome: bracket.minIncome,
        maxIncome: bracket.maxIncome,
        taxRate: bracket.taxRate,
        quickDeduction: bracket.quickDeduction,
        effectiveFrom: new Date("2025-01-01"),
        effectiveTo: null,
      },
    });
  }

  // 创建社保配置
  await prisma.socialInsuranceConfig.create({
    data: hangzhouSocialConfig,
  });

  // 创建上海的示例配置
  const shanghaiSocialConfig = {
    city: "Shanghai",
    socialMinBase: 5975,
    socialMaxBase: 31014,
    pensionRate: 0.08,
    medicalRate: 0.02,
    unemploymentRate: 0.005,
    housingFundMinBase: 5975,
    housingFundMaxBase: 34188,
    housingFundRate: 0.07, // 上海公积金比例通常为7%
    effectiveFrom: new Date("2025-01-01"),
    effectiveTo: null,
  };

  // 创建税率档次（上海，与全国一致）
  for (const bracket of taxBrackets) {
    await prisma.taxBracket.create({
      data: {
        city: "Shanghai",
        minIncome: bracket.minIncome,
        maxIncome: bracket.maxIncome,
        taxRate: bracket.taxRate,
        quickDeduction: bracket.quickDeduction,
        effectiveFrom: new Date("2025-01-01"),
        effectiveTo: null,
      },
    });
  }

  await prisma.socialInsuranceConfig.create({
    data: shanghaiSocialConfig,
  });

  console.log("税务数据初始化完成！");
  console.log("- 已创建杭州和上海的税率档次");
  console.log("- 已创建杭州和上海的社保公积金配置");
}

async function main() {
  try {
    await seedTaxData();
  } catch (error) {
    console.error("初始化税务数据失败:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// 立即执行
main();

export { seedTaxData };
