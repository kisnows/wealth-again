// prisma/seed.js (CommonJS，便于直接运行)
// 参考 doc/data.md 的重点数据，初始化城市规则、税制、工资/奖金/LTC 示例
/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function upsertTax(country, year) {
  const cfg = await prisma.taxConfig.upsert({
    where: { country_taxYear: { country, taxYear: year } },
    update: {},
    create: {
      country,
      taxYear: year,
      standardDeduction: 5000,
      specialAdditionalDeduction: 0,
    },
  });
  const brackets = [
    { position: 1, threshold: 36000, rate: 0.03, quick: 0 },
    { position: 2, threshold: 144000, rate: 0.1, quick: 2520 },
    { position: 3, threshold: 300000, rate: 0.2, quick: 16920 },
    { position: 4, threshold: 420000, rate: 0.25, quick: 31920 },
    { position: 5, threshold: 660000, rate: 0.3, quick: 52920 },
    { position: 6, threshold: 960000, rate: 0.35, quick: 85920 },
    { position: 7, threshold: 1_000_000_000, rate: 0.45, quick: 181920 },
  ];
  for (const b of brackets) {
    await prisma.taxBracket.upsert({
      where: {
        country_taxYear_position: {
          country,
          taxYear: year,
          position: b.position,
        },
      },
      update: {
        threshold: b.threshold,
        taxRate: b.rate,
        quickDeduction: b.quick,
      },
      create: {
        country,
        taxYear: year,
        position: b.position,
        threshold: b.threshold,
        taxRate: b.rate,
        quickDeduction: b.quick,
      },
    });
  }
  return cfg;
}

async function seed() {
  console.log("Seeding start...");
  const hz = await prisma.city.upsert({
    where: { name: "Hangzhou" },
    update: {},
    create: { name: "Hangzhou", country: "CN" },
  });

  const user = await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {},
    create: {
      email: "demo@example.com",
      password: "hashed",
      name: "Demo",
      baseCurrency: "CNY",
      currentCityId: hz.id,
    },
  });

  // 社保（示例：ZJ 区间）
  await prisma.cityRuleSS.upsert({
    where: {
      cityId_startDate: { cityId: hz.id, startDate: new Date("2023-01-01") },
    },
    update: {},
    create: {
      cityId: hz.id,
      startDate: new Date("2023-01-01"),
      endDate: new Date("2024-01-01"),
      baseMin: 4462,
      baseMax: 24060,
      ratePension: 0.08,
      rateMedical: 0.02,
      rateUnemployment: 0.005,
    },
  });
  await prisma.cityRuleSS.upsert({
    where: {
      cityId_startDate: { cityId: hz.id, startDate: new Date("2024-01-01") },
    },
    update: {},
    create: {
      cityId: hz.id,
      startDate: new Date("2024-01-01"),
      endDate: new Date("2025-01-01"),
      baseMin: 4812,
      baseMax: 24930,
      ratePension: 0.08,
      rateMedical: 0.02,
      rateUnemployment: 0.005,
    },
  });
  await prisma.cityRuleSS.upsert({
    where: {
      cityId_startDate: { cityId: hz.id, startDate: new Date("2025-01-01") },
    },
    update: {},
    create: {
      cityId: hz.id,
      startDate: new Date("2025-01-01"),
      endDate: null,
      baseMin: 4812,
      baseMax: 24930,
      ratePension: 0.08,
      rateMedical: 0.02,
      rateUnemployment: 0.005,
      fixedMedicalPersonal: 3,
    },
  });

  // 公积金
  await prisma.cityRuleHF.upsert({
    where: {
      cityId_startDate: { cityId: hz.id, startDate: new Date("2023-07-01") },
    },
    update: {},
    create: {
      cityId: hz.id,
      startDate: new Date("2023-07-01"),
      endDate: new Date("2024-07-01"),
      baseMin: 2280,
      baseMax: 38390,
      rateEmployee: 0.12,
    },
  });
  await prisma.cityRuleHF.upsert({
    where: {
      cityId_startDate: { cityId: hz.id, startDate: new Date("2024-07-01") },
    },
    update: {},
    create: {
      cityId: hz.id,
      startDate: new Date("2024-07-01"),
      endDate: new Date("2025-07-01"),
      baseMin: 2490,
      baseMax: 39530,
      rateEmployee: 0.12,
    },
  });
  await prisma.cityRuleHF.upsert({
    where: {
      cityId_startDate: { cityId: hz.id, startDate: new Date("2025-07-01") },
    },
    update: {},
    create: {
      cityId: hz.id,
      startDate: new Date("2025-07-01"),
      endDate: null,
      baseMin: 2490,
      baseMax: 40694,
      rateEmployee: 0.12,
    },
  });

  // 税制
  for (const y of [2023, 2024, 2025]) await upsertTax("CN", y);

  // 年度专项附加扣除（示例：每年 12000，均摊至每月 1000）
  await prisma.userAnnualDeduction.createMany({
    data: [
      {
        userId: user.id,
        taxYear: 2023,
        annualAmount: 12000,
        allocationRule: "AVERAGE",
        note: "示例专项附加扣除（平均分摊）",
      },
      {
        userId: user.id,
        taxYear: 2024,
        annualAmount: 12000,
        allocationRule: "AVERAGE",
        note: "示例专项附加扣除（平均分摊）",
      },
      {
        userId: user.id,
        taxYear: 2025,
        annualAmount: 12000,
        allocationRule: "AVERAGE",
        note: "示例专项附加扣除（平均分摊）",
      },
    ],
    skipDuplicates: true,
  });

  // 工资变更
  try {
    await prisma.incomeChange.createMany({
      data: [
        {
          userId: user.id,
          grossMonthly: 11000,
          currency: "CNY",
          effectiveFrom: new Date("2023-01-01"),
        },
        {
          userId: user.id,
          grossMonthly: 13000,
          currency: "CNY",
          effectiveFrom: new Date("2024-01-01"),
        },
        {
          userId: user.id,
          grossMonthly: 15000,
          currency: "CNY",
          effectiveFrom: new Date("2025-01-01"),
        },
      ],
    });
  } catch (_e) {
    // 忽略重复插入错误
    console.log("IncomeChange data already exists, skipping...");
  }

  // 奖金（每年1月）
  try {
    await prisma.bonusPlan.createMany({
      data: [
        {
          userId: user.id,
          amount: 20000,
          currency: "CNY",
          effectiveDate: new Date("2023-01-10"),
        },
        {
          userId: user.id,
          amount: 20000,
          currency: "CNY",
          effectiveDate: new Date("2024-01-10"),
        },
        {
          userId: user.id,
          amount: 20000,
          currency: "CNY",
          effectiveDate: new Date("2025-01-10"),
        },
      ],
    });
  } catch (_e) {
    // 忽略重复插入错误
    console.log("BonusPlan data already exists, skipping...");
  }

  // 长期现金：每年 4 月授予，季度 4 期
  async function createLTCPlan(year) {
    try {
      const plan = await prisma.longTermCashPlan.create({
        data: {
          userId: user.id,
          totalAmount: 12000,
          currency: "CNY",
          startDate: new Date(`${year}-04-01`),
          periods: 4,
          recurrence: "QUARTERLY",
        },
      });
      const per = 12000 / 4;
      try {
        await prisma.longTermCashPayout.createMany({
          data: [
            {
              planId: plan.id,
              payDate: new Date(`${year}-04-01`),
              amount: per,
              currency: "CNY",
            },
            {
              planId: plan.id,
              payDate: new Date(`${year}-07-01`),
              amount: per,
              currency: "CNY",
            },
            {
              planId: plan.id,
              payDate: new Date(`${year}-10-01`),
              amount: per,
              currency: "CNY",
            },
            {
              planId: plan.id,
              payDate: new Date(`${year + 1}-01-01`),
              amount: per,
              currency: "CNY",
            },
          ],
        });
      } catch (_e) {
        console.log(`LTC Payouts for ${year} already exist, skipping...`);
      }
    } catch (_e) {
      console.log(`LTC Plan for ${year} already exists, skipping...`);
    }
  }
  await createLTCPlan(2023);
  await createLTCPlan(2024);
  await createLTCPlan(2025);

  console.log("Seeding done.");
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
