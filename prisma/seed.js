// prisma/seed.js (CommonJS，便于直接运行)
// 参考 doc/data.md 的重点数据，初始化城市规则、税制、账户与交易示例
/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function upsertTax(country, year) {
  const cfg = await prisma.taxConfig.upsert({
    where: { country_taxYear: { country, taxYear: year } },
    update: {
      standardDeduction: 5000,
      specialAdditionalDeduction: 0,
    },
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

  // --- 清理旧数据，确保幂等 ---
  await prisma.cityChangeRecord.deleteMany({ where: { userId: user.id } });
  await prisma.auditLog.deleteMany({ where: { userId: user.id } });
  await prisma.valuationSnapshot.deleteMany({
    where: { account: { userId: user.id } },
  });
  await prisma.txnLine.deleteMany({
    where: { entry: { userId: user.id } },
  });
  await prisma.txnEntry.deleteMany({ where: { userId: user.id } });
  await prisma.account.deleteMany({ where: { userId: user.id } });
  await prisma.incomeRecord.deleteMany({ where: { userId: user.id } });
  await prisma.longTermCashPayout.deleteMany({
    where: { plan: { userId: user.id } },
  });
  await prisma.longTermCashPlan.deleteMany({ where: { userId: user.id } });
  await prisma.bonusPlan.deleteMany({ where: { userId: user.id } });
  await prisma.incomeChange.deleteMany({ where: { userId: user.id } });
  await prisma.userAnnualDeduction.deleteMany({ where: { userId: user.id } });
  await prisma.fxRate.deleteMany({ where: { base: "USD" } });

  // --- 城市规则 ---
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

  for (const y of [2023, 2024, 2025]) await upsertTax("CN", y);

  await prisma.userAnnualDeduction.createMany({
    data: [
      {
        userId: user.id,
        taxYear: 2023,
        annualAmount: 0,
        allocationRule: "NONE",
        note: "示例专项附加扣除：无",
      },
      {
        userId: user.id,
        taxYear: 2024,
        annualAmount: 0,
        allocationRule: "NONE",
        note: "示例专项附加扣除：无",
      },
      {
        userId: user.id,
        taxYear: 2025,
        annualAmount: 0,
        allocationRule: "NONE",
        note: "示例专项附加扣除：无",
      },
    ],
  });

  await prisma.incomeChange.createMany({
    data: [
      {
        userId: user.id,
        grossMonthly: 12000,
        currency: "CNY",
        effectiveFrom: new Date("2023-01-01"),
      },
      {
        userId: user.id,
        grossMonthly: 15000,
        currency: "CNY",
        effectiveFrom: new Date("2024-01-01"),
      },
      {
        userId: user.id,
        grossMonthly: 20000,
        currency: "CNY",
        effectiveFrom: new Date("2025-01-01"),
      },
    ],
  });

  await prisma.bonusPlan.createMany({
    data: [
      {
        userId: user.id,
        amount: 20000,
        currency: "CNY",
        effectiveDate: new Date("2024-12-15"),
      },
      {
        userId: user.id,
        amount: 30000,
        currency: "CNY",
        effectiveDate: new Date("2025-03-15"),
      },
    ],
  });

  const ltcPlan = await prisma.longTermCashPlan.create({
    data: {
      userId: user.id,
      totalAmount: 160000,
      currency: "CNY",
      startDate: new Date("2025-01-01"),
      periods: 16,
      recurrence: "CUSTOM",
    },
  });
  const ltcPayDates = [
    "2025-01-01",
    "2025-03-01",
    "2025-04-01",
    "2025-06-01",
    "2025-07-01",
    "2025-09-01",
    "2025-10-01",
    "2025-12-01",
    "2026-01-01",
    "2026-03-01",
    "2026-04-01",
    "2026-06-01",
    "2026-07-01",
    "2026-09-01",
    "2026-10-01",
    "2026-12-01",
  ];
  const ltcAmount = 160000 / ltcPayDates.length;
  await prisma.longTermCashPayout.createMany({
    data: ltcPayDates.map((iso) => ({
      planId: ltcPlan.id,
      payDate: new Date(iso),
      amount: ltcAmount,
      currency: "CNY",
    })),
  });

  await prisma.cityChangeRecord.create({
    data: {
      userId: user.id,
      fromCityId: null,
      toCityId: hz.id,
      effectiveMonth: new Date("2023-01-01"),
      reason: "入驻杭州",
    },
  });

  // --- 账户与汇率 ---
  const cnySavings = await prisma.account.create({
    data: {
      userId: user.id,
      name: "工商",
      accountType: "SAVINGS",
      baseCurrency: "CNY",
      description: "工资结算账户",
    },
  });
  const cnyInvestment = await prisma.account.create({
    data: {
      userId: user.id,
      name: "同花顺",
      accountType: "INVESTMENT",
      baseCurrency: "CNY",
      subType: "A 股",
      description: "国内股票账户",
    },
  });
  const cnyLoan = await prisma.account.create({
    data: {
      userId: user.id,
      name: "借款",
      accountType: "LOAN",
      baseCurrency: "CNY",
      description: "房贷示例",
    },
  });
  const usdSavings = await prisma.account.create({
    data: {
      userId: user.id,
      name: "测试美金",
      accountType: "SAVINGS",
      baseCurrency: "USD",
      description: "外汇账户",
    },
  });

  const usdToCny = await prisma.fxRate.create({
    data: {
      base: "USD",
      quote: "CNY",
      rate: 7,
      effectiveFrom: new Date("2025-10-12T08:00:00Z"),
      effectiveTo: null,
    },
  });

  // --- 账户流水 ---
  const depositEntry = await prisma.txnEntry.create({
    data: {
      userId: user.id,
      type: "DEPOSIT",
      occurredAt: new Date("2025-10-10T09:00:00Z"),
      note: "初始化存款",
      lines: {
        create: [
          {
            accountId: cnySavings.id,
            type: "DEPOSIT",
            amount: 500,
            currency: "CNY",
            principalDelta: 500,
            valuationDelta: 500,
            note: "初始资金",
          },
        ],
      },
    },
  });

  // 同币种转账
  const sameCurrencyAt = new Date("2025-10-21T15:28:00Z");
  await prisma.txnEntry.create({
    data: {
      userId: user.id,
      type: "TRANSFER",
      occurredAt: sameCurrencyAt,
      note: "偿还部分借款",
      meta: JSON.stringify({
        fromAmount: 5,
        fromCurrency: "CNY",
        toAmount: 5,
        toCurrency: "CNY",
        effectiveRate: 1,
        viaCurrency: "USD",
        rateAtoUsd: 1,
        rateUsdToB: 1,
        fxEffectiveAt: sameCurrencyAt.toISOString(),
        rateSnapshots: [],
        asOf: sameCurrencyAt.toISOString(),
      }),
      lines: {
        create: [
          {
            accountId: cnySavings.id,
            type: "TRANSFER",
            amount: -5,
            currency: "CNY",
            counterpartyAccountId: cnyLoan.id,
            counterpartyName: "借款",
            exchangeRateAB: 1,
            viaCurrency: "USD",
            rateAtoUSD: 1,
            rateUSDtoB: 1,
            fxEffectiveAt: sameCurrencyAt,
            principalDelta: -5,
            valuationDelta: -5,
          },
          {
            accountId: cnyLoan.id,
            type: "TRANSFER",
            amount: 5,
            currency: "CNY",
            counterpartyAccountId: cnySavings.id,
            counterpartyName: "工商",
            exchangeRateAB: 1,
            viaCurrency: "USD",
            rateAtoUSD: 1,
            rateUSDtoB: 1,
            fxEffectiveAt: sameCurrencyAt,
            principalDelta: 5,
            valuationDelta: 5,
          },
        ],
      },
    },
  });

  // 跨币种转账 USD -> CNY
  const crossCurrencyAt = new Date("2025-10-12T23:37:00Z");
  await prisma.txnEntry.create({
    data: {
      userId: user.id,
      type: "TRANSFER",
      occurredAt: crossCurrencyAt,
      fxRateId: usdToCny.id,
      note: "外汇兑入 A 股账户",
      meta: JSON.stringify({
        fromAmount: 100,
        fromCurrency: "USD",
        toAmount: 700,
        toCurrency: "CNY",
        effectiveRate: 7,
        viaCurrency: "USD",
        rateAtoUsd: 1,
        rateUsdToB: 7,
        fxEffectiveAt: crossCurrencyAt.toISOString(),
        rateSnapshots: [
          {
            base: "USD",
            quote: "CNY",
            rate: 7,
            effectiveFrom: usdToCny.effectiveFrom.toISOString(),
            effectiveTo: null,
            id: usdToCny.id,
          },
        ],
        asOf: crossCurrencyAt.toISOString(),
      }),
      lines: {
        create: [
          {
            accountId: usdSavings.id,
            type: "TRANSFER",
            amount: -100,
            currency: "USD",
            counterpartyAccountId: cnyInvestment.id,
            counterpartyName: "同花顺",
            exchangeRateAB: 7,
            viaCurrency: "USD",
            rateAtoUSD: 1,
            rateUSDtoB: 7,
            fxEffectiveAt: crossCurrencyAt,
            principalDelta: -100,
            valuationDelta: -100,
          },
          {
            accountId: cnyInvestment.id,
            type: "TRANSFER",
            amount: 700,
            currency: "CNY",
            counterpartyAccountId: usdSavings.id,
            counterpartyName: "测试美金",
            exchangeRateAB: 7,
            viaCurrency: "USD",
            rateAtoUSD: 1,
            rateUSDtoB: 7,
            fxEffectiveAt: crossCurrencyAt,
            principalDelta: 700,
            valuationDelta: 700,
          },
        ],
      },
    },
  });

  // 取现（示例）
  await prisma.txnEntry.create({
    data: {
      userId: user.id,
      type: "WITHDRAW",
      occurredAt: new Date("2025-10-17T17:56:00Z"),
      note: "投资账户提现",
      lines: {
        create: [
          {
            accountId: cnyInvestment.id,
            type: "WITHDRAW",
            amount: -140,
            currency: "CNY",
            principalDelta: -140,
            valuationDelta: -140,
          },
        ],
      },
    },
  });

  // 估值快照
  await prisma.valuationSnapshot.createMany({
    data: [
      {
        accountId: cnyInvestment.id,
        asOf: new Date("2025-10-11T16:12:00Z"),
        totalValue: 6500,
        currency: "CNY",
      },
      {
        accountId: cnySavings.id,
        asOf: new Date(depositEntry.occurredAt),
        totalValue: 500,
        currency: "CNY",
      },
      {
        accountId: usdSavings.id,
        asOf: new Date("2025-10-12T08:00:00Z"),
        totalValue: 100,
        currency: "USD",
      },
    ],
  });

  // --- 月度收入记录（2025 年 1-3 月） ---
  const incomeRows = [
    {
      monthDate: "2025-01-01",
      gross: 20000,
      bonus: 0,
      ltcIncome: 0,
      socialInsurance: 2103,
      housingFund: 2400,
      taxableIncome: 10500,
      taxableCumulative: 10500,
      incomeTax: 1050,
      taxCumulative: 1050,
      taxPaid: 1050,
      netIncome: 14447,
    },
    {
      monthDate: "2025-02-01",
      gross: 20000,
      bonus: 0,
      ltcIncome: 0,
      socialInsurance: 2103,
      housingFund: 2400,
      taxableIncome: 10500,
      taxableCumulative: 21000,
      incomeTax: 1050,
      taxCumulative: 2100,
      taxPaid: 2100,
      netIncome: 14447,
    },
    {
      monthDate: "2025-03-01",
      gross: 20000,
      bonus: 30000,
      ltcIncome: 10000,
      socialInsurance: 2103,
      housingFund: 2400,
      taxableIncome: 50497,
      taxableCumulative: 71497,
      incomeTax: 10624.85,
      taxCumulative: 12724.85,
      taxPaid: 12724.85,
      netIncome: 44872.15,
    },
  ];

  await prisma.incomeRecord.createMany({
    data: incomeRows.map((row) => ({
      userId: user.id,
      monthDate: new Date(row.monthDate),
      cityId: hz.id,
      currency: "CNY",
      gross: row.gross,
      bonus: row.bonus,
      ltcIncome: row.ltcIncome,
      socialInsuranceBase: row.gross,
      housingFundBase: row.gross,
      socialInsurance: row.socialInsurance,
      housingFund: row.housingFund,
      specialDeductions: 0,
      otherDeductions: 0,
      charityDonations: 0,
      taxableIncome: row.taxableIncome,
      taxableCumulative: row.taxableCumulative,
      incomeTax: row.incomeTax,
      taxCumulative: row.taxCumulative,
      taxPaid: row.taxPaid,
      netIncome: row.netIncome,
      isForecast: false,
    })),
  });

  await prisma.auditLog.createMany({
    data: [
      {
        userId: user.id,
        action: "ACCOUNT_SEED",
        meta: JSON.stringify({ message: "Seeded demo accounts and balances" }),
      },
      {
        userId: user.id,
        action: "INCOME_SEED",
        meta: JSON.stringify({ message: "Seeded demo income records" }),
      },
    ],
  });

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
