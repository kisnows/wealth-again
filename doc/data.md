没问题！我给你一套**可直接跑**的 Prisma 表结构（`schema.prisma`）+ **种子脚本**（`prisma/seed.ts`），满足：

- mock \*\*最近三年（2023/2024/2025）\*\*的月度收入；
- **奖金**：每年 1 次（示例放在 **1 月**，你可改）。
- **长期现金**：每年 **4 月授予**，**按季度发放**（每年 4 期）。
- **股权激励：无**（本次不生成）。
- **税务**：按中国**综合所得**累计计税规则，近三年**标准扣除 5000/月**、**年度税表档**与**速算扣除数**（2019 起沿用至今）。来源：PwC 税务摘要（标准扣除、年度/每月税率表）。([普华永道税务摘要][1])
- **社保/公积金（杭州）**：

  - **社保个人缴费比例**示例：**养老 8% / 医疗 2% / 失业 0.5%**（全国常见口径，杭州与浙江省普遍一致，作为示例比例使用）。([china.acclime.com][2], [Air Corporate][3])
  - **社保缴费基数上下限（浙江省口径，杭州适用）**：

    - **2023**：上限 **24,060**，下限 **4,462**（由 2024 公告“较上年+870/+350”反推）。([浙江省税务局][4], [12333 服务热线][5])
    - **2024**：上限 **24,930**，下限 **4,812**（官方）。([浙江省税务局][4], [12333 服务热线][5])
    - **2025**：**暂按 2024 不变**（若有新政，请覆盖 seed）。

  - **住房公积金（杭州）缴存基数**：

    - **2023**：上限 **38,390**，下限 **2,280**；**比例区间 5–12%**（示例用 **员工 12%**）。([12333 服务热线][6], [澎湃新闻][7], [东方网][8])
    - **2024**：上限 **39,530**，下限 **2,490**（自 **2024-07-01** 起执行；比例区间 5–12%，示例员工 12%）。([杭网议事厅][9], [jiande.gov.cn][10], [本地宝][11])
    - **2025**：上限 **40,694**，下限 **2,490**（**2025-07-01** 起执行）。([杭网议事厅][12])

> 说明：seed 里将以上**按时间区间**写入 `CityRuleSS`（社保）与 `CityRuleHF`（公积金）规则，满足你“**每月按当月实际生效数据**计算”的诉求。
> 若你已有前文我给的更多模型（账本分录等），此 schema 也兼容；本次为**收入侧最小闭环**。

---

# 1) `schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

/* ==== 基础枚举（用字符串枚举语义） ==== */
enum RecurrenceLike {
  MONTHLY
  QUARTERLY
  YEARLY
}

/* ==== 用户 ==== */
model User {
  id           String           @id @default(uuid())
  email        String           @unique
  password     String
  name         String?
  baseCurrency String           @default("CNY")
  currentCity  String           @default("Hangzhou")
  isActive     Boolean          @default(true)
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  incomes       IncomeRecord[]
  incomeChanges IncomeChange[]
  bonusPlans    BonusPlan[]
  ltcPlans      LongTermCashPlan[]

  @@index([email])
  @@index([isActive])
}

/* ==== 城市 & 规则 ==== */
model City {
  id        String   @id @default(uuid())
  name      String   @unique
  country   String   @default("CN")
  createdAt DateTime @default(now())

  ssRules CityRuleSS[]
  hfRules CityRuleHF[]
}

model CityRuleSS {
  id               String   @id @default(uuid())
  cityId           String
  startDate        DateTime
  endDate          DateTime?
  baseMin          Decimal
  baseMax          Decimal
  ratePension      Decimal   // 个人
  rateMedical      Decimal   // 个人
  rateUnemployment Decimal   // 个人
  createdAt        DateTime  @default(now())

  city             City     @relation(fields: [cityId], references: [id])

  @@unique([cityId, startDate])
  @@index([cityId, startDate])
}

model CityRuleHF {
  id           String   @id @default(uuid())
  cityId       String
  startDate    DateTime
  endDate      DateTime?
  baseMin      Decimal
  baseMax      Decimal
  rateEmployee Decimal   // 个人比例
  createdAt    DateTime  @default(now())

  city         City      @relation(fields: [cityId], references: [id])

  @@unique([cityId, startDate])
  @@index([cityId, startDate])
}

/* ==== 税制（国家 + 税年） ==== */
model TaxConfig {
  id                String   @id @default(uuid())
  country           String
  taxYear           Int
  standardDeduction Decimal  // 月度起征额（例：5000）

  createdAt         DateTime @default(now())
  brackets          TaxBracket[]

  @@unique([country, taxYear])
}

model TaxBracket {
  id             String   @id @default(uuid())
  country        String
  taxYear        Int
  position       Int
  threshold      Decimal   // 年度累计应纳税所得额阈值上限（含）
  taxRate        Decimal
  quickDeduction Decimal

  config         TaxConfig @relation(fields: [country, taxYear], references: [country, taxYear], onDelete: Cascade, onUpdate: Cascade)

  @@unique([country, taxYear, position])
}

/* ==== 收入（工资变更/奖金/长期现金/月度记录） ==== */
model IncomeChange {
  id            String   @id @default(uuid())
  userId        String
  grossMonthly  Decimal
  currency      String   @default("CNY")
  effectiveFrom DateTime
  createdAt     DateTime @default(now())

  user          User     @relation(fields: [userId], references: [id])

  @@index([userId, effectiveFrom])
}

model BonusPlan {
  id            String   @id @default(uuid())
  userId        String
  amount        Decimal
  currency      String   @default("CNY")
  effectiveDate DateTime
  createdAt     DateTime @default(now())

  user          User     @relation(fields: [userId], references: [id])

  @@index([userId, effectiveDate])
}

model LongTermCashPlan {
  id          String   @id @default(uuid())
  userId      String
  totalAmount Decimal
  currency    String   @default("CNY")
  startDate   DateTime           // 授予起始（第一期）
  periods     Int                // 每年4期：示例=4
  recurrence  String             // QUARTERLY
  createdAt   DateTime @default(now())

  user        User     @relation(fields: [userId], references: [id])
  payouts     LongTermCashPayout[]

  @@index([userId, startDate])
}

model LongTermCashPayout {
  id        String   @id @default(uuid())
  planId    String
  payDate   DateTime
  amount    Decimal
  createdAt DateTime @default(now())

  plan      LongTermCashPlan @relation(fields: [planId], references: [id])
  @@unique([planId, payDate])
}

model IncomeRecord {
  id                  String   @id @default(uuid())
  userId              String
  monthDate           DateTime // 当月第一天
  cityId              String?
  currency            String   @default("CNY")

  // 来自工资/奖金/长期现金等的“毛收入”组成
  gross               Decimal              // 月薪（从 IncomeChange 推）
  bonus               Decimal? @default(0) // 一次性奖金（同月累加）
  otherIncome         Decimal? @default(0) // 长期现金等合计（可扩展）

  // 基数可覆盖
  socialInsuranceBase Decimal?
  housingFundBase     Decimal?

  // 计算快照
  socialInsurance     Decimal? @default(0)
  housingFund         Decimal? @default(0)
  specialDeductions   Decimal? @default(0)
  otherDeductions     Decimal? @default(0)
  charityDonations    Decimal? @default(0)

  taxableIncome       Decimal?
  incomeTax           Decimal?
  taxPaid             Decimal? @default(0) // 累计已缴
  netIncome           Decimal?
  isForecast          Boolean  @default(false)

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  user                User     @relation(fields: [userId], references: [id])
  city                City?    @relation(fields: [cityId], references: [id])

  @@unique([userId, monthDate])
  @@index([userId, monthDate])
}
```

---

# 2) `prisma/seed.ts`

> 作用：
>
> 1. 创建一个演示用户（杭州）；
> 2. 写入 **杭州** 的 **社保/公积金** 三年历史规则（含**生效区间**）；
> 3. 写入 **中国 2023/2024/2025** 税制（标准扣除 `5000`、年度档/速算扣除）；
> 4. mock **最近三年**的收入：
>
>    - 工资：2023 起 11k/月，2024 起 13k/月，2025 起 15k/月（你可改）；
>    - 奖金：每年 **1 月 20k**；
>    - 长期现金：每年 **4 月开始**授予 **12,000/年**，按季度发放 **4 期**（各期均等 3,000），落到当年 4/7/10/次年 1 月；
>
> 5. 将 2023/01 ～ 2025/08 各月生成 `IncomeRecord`（示例 2025 年截止 8 月）。

```ts
// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// 工具：月首
const monthStart = (y: number, m: number) =>
  new Date(`${y}-${String(m).padStart(2, "0")}-01T00:00:00.000Z`);

async function upsertTax(country: string, year: number) {
  // 标准扣除 5000/月（2019 起沿用）
  const cfg = await prisma.taxConfig.upsert({
    where: { country_taxYear: { country, taxYear: year } },
    update: {},
    create: { country, taxYear: year, standardDeduction: 5000 },
  });

  const brackets = [
    { position: 1, threshold: 36000, rate: 0.03, quick: 0 },
    { position: 2, threshold: 144000, rate: 0.1, quick: 2520 },
    { position: 3, threshold: 300000, rate: 0.2, quick: 16920 },
    { position: 4, threshold: 420000, rate: 0.25, quick: 31920 },
    { position: 5, threshold: 660000, rate: 0.3, quick: 52920 },
    { position: 6, threshold: 960000, rate: 0.35, quick: 85920 },
    { position: 7, threshold: 1_000_000_000, rate: 0.45, quick: 181920 }, // 近似 +∞
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
  // 0) demo 用户 + 城市
  const user = await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {},
    create: {
      email: "demo@example.com",
      password: "hashed",
      name: "Demo",
      baseCurrency: "CNY",
      currentCity: "Hangzhou",
    },
  });

  const hz = await prisma.city.upsert({
    where: { name: "Hangzhou" },
    update: {},
    create: { name: "Hangzhou", country: "CN" },
  });

  // 1) 城市规则：社保（ZJ 口径，杭州适用）
  // 2023: 上限 24060，下限 4462（由 2024 公告反推）
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

  // 2024: 上限 24930，下限 4812（官方）
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

  // 2025: 暂按 2024 同值（如有新政，覆盖此条）
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
    },
  });

  // 2) 城市规则：住房公积金（杭州）
  // 2023-07-01 ~ 2024-06-30：上限 38390，下限 2280
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

  // 2024-07-01 ~ 2025-06-30：上限 39530，下限 2490
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

  // 2025-07-01 起：上限 40694，下限 2490
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

  // 3) 税制：CN 2023/2024/2025
  for (const y of [2023, 2024, 2025]) {
    await upsertTax("CN", y);
  }

  // 4) 工资变更（示例）：2023-01 起 11000，2024-01 起 13000，2025-01 起 15000
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
    skipDuplicates: true,
  });

  // 5) 奖金：每年 1 月 20000
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
    skipDuplicates: true,
  });

  // 6) 长期现金：每年 4 月授予，年度总额 12000，季度发放（4 期）
  async function createLTCPlan(year: number) {
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
    const payouts = [
      { planId: plan.id, payDate: new Date(`${year}-04-01`), amount: per },
      { planId: plan.id, payDate: new Date(`${year}-07-01`), amount: per },
      { planId: plan.id, payDate: new Date(`${year}-10-01`), amount: per },
      { planId: plan.id, payDate: new Date(`${year + 1}-01-01`), amount: per },
    ];
    await prisma.longTermCashPayout.createMany({ data: payouts });
  }
  await createLTCPlan(2023);
  await createLTCPlan(2024);
  await createLTCPlan(2025);

  // 7) 生成 2023/01 ~ 2025/08 的 IncomeRecord（月薪+奖金+长期现金只做占位，具体“社保/公积金/个税/税后”请用你的计算器回填）
  const end = { year: 2025, month: 8 };
  for (let y = 2023; y <= end.year; y++) {
    const maxM = y === end.year ? end.month : 12;
    for (let m = 1; m <= maxM; m++) {
      const d = monthStart(y, m);

      // 决定该月工资：取 <= 当月第一天 的最近一条 IncomeChange
      const change = await prisma.incomeChange.findFirst({
        where: { userId: user.id, effectiveFrom: { lte: d } },
        orderBy: { effectiveFrom: "desc" },
      });
      const gross = Number(change?.grossMonthly ?? 0);

      // 奖金：当月所有 bonus 累加
      const bonusAgg = await prisma.bonusPlan.aggregate({
        _sum: { amount: true },
        where: {
          userId: user.id,
          effectiveDate: {
            gte: d,
            lt: monthStart(y, m === 12 ? 1 : m + 1).setFullYear(
              y + (m === 12 ? 1 : 0)
            ),
          },
        },
      });
      const bonus = Number(bonusAgg._sum.amount ?? 0);

      // 长期现金：当月所有 payout 累加
      const ltcAgg = await prisma.longTermCashPayout.aggregate({
        _sum: { amount: true },
        where: {
          plan: { userId: user.id },
          payDate: {
            gte: d,
            lt: monthStart(y, m === 12 ? 1 : m + 1).setFullYear(
              y + (m === 12 ? 1 : 0)
            ),
          },
        },
      });
      const ltc = Number(ltcAgg._sum.amount ?? 0);

      // 写 IncomeRecord（仅放入毛收入侧，计算项稍后用回算服务写回）
      await prisma.incomeRecord.upsert({
        where: { userId_monthDate: { userId: user.id, monthDate: d } },
        update: {
          gross,
          bonus,
          otherIncome: ltc,
          cityId: hz.id,
          isForecast: y === 2025 && m > 6, // 示例：把 2025/07-08 标记为预测
        },
        create: {
          userId: user.id,
          monthDate: d,
          cityId: hz.id,
          currency: "CNY",
          gross,
          bonus,
          otherIncome: ltc,
          isForecast: y === 2025 && m > 6,
        },
      });
    }
  }

  console.log("Seed finished.");
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

## 使用方法

```bash
# 1) 安装依赖
pnpm add -D prisma tsx
pnpm add @prisma/client

# 2) 生成与迁移
pnpm prisma generate
pnpm prisma migrate dev --name init_income_rules

# 3) 跑 seed
pnpm tsx prisma/seed.ts
```

> 跑完后，你将得到：
>
> - `User`（杭州）
> - 2023/01 ～ 2025/08 的 `IncomeRecord`（含月薪、奖金、长期现金叠加的“毛收入”位）
> - `CityRuleSS/HF` 的**三年**历史区间（覆盖 **2023/01、2024/01、2025/01** 的社保与 **2023/07、2024/07、2025/07** 的公积金切换点）
> - `TaxConfig/TaxBracket`（CN 2023–2025）

随后你可用我先前给你的 **年度累计计算器** 对这些 `IncomeRecord` 进行**1–M 月累计回算**，写回：`socialInsurance/housingFund/taxableIncome/incomeTax/taxPaid/netIncome`，从而完全符合你“**展示 5–8 月，但计算必须从 1 月累计**”的规则。

---

## 参考与依据

- **标准扣除（5,000/月）、综合所得税表（年度/每月档）**：PwC 中国税务摘要（最新审核 2025-07-02）。([普华永道税务摘要][1])
- **社保基数（浙江省 2024 公告 + 2023 变动幅度）**：浙江税务/人社发布。([浙江省税务局][4], [12333 服务热线][5])
- **公积金（杭州）**：

  - **2023** 上限 **38390**、下限 **2280**：官方与主流媒体发布。([12333 服务热线][6], [澎湃新闻][7], [东方网][8])
  - **2024** 上限 **39530**、下限 **2490**：杭州公积金中心与政务发布。([杭网议事厅][9], [jiande.gov.cn][10], [本地宝][11])
  - **2025** 上限 **40694**、下限 **2490**：杭州网专题稿（政务口径）。([杭网议事厅][12])

- **公积金比例（杭州常见为员工 12%）**：城市与咨询机构梳理。([fdichina.com][13], [chaadhr.com][14])
- **社保个人比例通用口径**（养老 8%、医疗 2%、失业 0.5%）：多家专业机构对中国社保的归纳。([china.acclime.com][2], [Air Corporate][3])

---

需要我把**年度累计计算器**（TS 版）也对接到这份 schema 上，顺带写一个 `scripts/recalcIncome.ts` 一键回算吗？我可以直接给你可跑的文件，衔接本 seed 的数据。

[1]: https://taxsummaries.pwc.com/peoples-republic-of-china/individual/deductions?utm_source=chatgpt.com "China, People's Republic of - Individual - Deductions"
[2]: https://china.acclime.com/guides/chinese-social-security-system/?utm_source=chatgpt.com "Chinese Social Security System at a Glance"
[3]: https://air-corporate.com/blog/chinese-social-security-system/?utm_source=chatgpt.com "A Guide to Chinese Social Security System - Air Corporate"
[4]: https://zhejiang.chinatax.gov.cn/art/2024/10/21/art_7575_626206.html?utm_source=chatgpt.com "国家税务总局浙江省税务局政策解读《关于公布2024年社会 ..."
[5]: https://m12333.cn/qa/pszbk.html?utm_source=chatgpt.com "浙江省公布2024年社保缴费基数上下限标准 ..."
[6]: https://m12333.cn/policy/mpepy.html?utm_source=chatgpt.com "杭州市关于开展2023年度住房公积金调整工作的通知"
[7]: https://www.thepaper.cn/newsDetail_forward_23741881?utm_source=chatgpt.com "杭州住房公积金有新调整！缴存基数有变化！"
[8]: https://j.eastday.com/p/1688627805046147?utm_source=chatgpt.com "杭州住房公积金调整缴存基数上限调整为38390元 - 东方新闻"
[9]: https://hwyst.hangzhou.com.cn/mtld/content/2024-08/02/content_8768441.htm?utm_source=chatgpt.com "上限39530元！事关住房公积金杭州最新调整"
[10]: https://www.jiande.gov.cn/art/2024/8/5/art_1229432762_1845163.html?utm_source=chatgpt.com "杭州住房公积金管理中心关于开展2024年度住房公积金调整 ..."
[11]: https://hz.bendibao.com/live/2014718/43676.shtm?utm_source=chatgpt.com "杭州公积金缴存指南"
[12]: https://hwyst.hangzhou.com.cn/mtld/content/2025-07/16/content_9039825.htm?utm_source=chatgpt.com "杭州公积金最新调整详解来了"
[13]: https://fdichina.com/blog/housing-fund-in-china/?utm_source=chatgpt.com "Guide to Housing Fund in China"
[14]: https://www.chaadhr.com/blog/payroll-in-china-key-payroll-regulations-in-hangzhou-every-employer-should-know?utm_source=chatgpt.com "Key Payroll Regulations in Hangzhou Every Employer ..."
