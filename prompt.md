# 一、我会补充/收紧的业务需求

## A. 个人收入管理（建议补充）

1. **地区与年度参数化**：按“城市 + 年份”维护社保/公积金基数上下限、比例、个税专项附加扣除标准（子女教育、住房贷款/租金、赡养老人等）。
2. **累计预扣法**支持：按照中国“累计预扣法”自动计算每月应纳税额与补退税（支持年中入职/涨薪/奖金）。
3. **多种收入类型**：工资、季度/年终奖、稿酬/劳务（如需），不同税目走不同计税规则（可选开启）。
4. **专项扣除与个税抵扣项**：专项附加扣除、商业健康险、企业年金/职业年金等（全部做成可配置字段与额度）。
5. **年度预测**：基于已发生数据 + 预计未来工资与奖金发放月份，**滚动预测全年税前/税后、累计个税、预计年终清算**。
6. **版本化参数**：历史月份按历史参数重算（保留“参数版本 + 生效期”），避免改了本年参数影响既往月份。
7. **导入/导出**：CSV 导入月度工资条（字段映射器），导出报表（CSV/Excel/PDF）。

## B. 投资管理系统（建议补充）

1. **收益口径明确**：

   - **TWR**（时间加权收益，排除现金流时点影响）
   - **MWR/XIRR**（资金加权收益，反映你真实投资体验）
   - **绝对收益额/净入金/手续费/税费/分红**全口径拆解。

2. **多账户/多币种**：账户层面（IBKR、港美券商、A 股、基金平台…），**资产以基准货币 CNY**汇总；每日/手动更新 FX 汇率。
3. **交易与持仓**：按**Lot**管理（买入批次），支持 FIFO/LIFO；计算**已实现/未实现**盈亏、股息（含预扣税）、基金分红、利息、费用、保证金利息。
4. **现金流类型**：注资、提现、转账（账户间）、股息、利息、红利再投、税费、费用、汇兑、期权权利金/行权（如你用期权）。
5. **估值快照**：按日（或手动）记录账户总市值与各标的价格，做 TWR 链接与回撤统计（Max Drawdown）。
6. **基准与超额**：选定基准（如沪深 300、VOO、QQQ、港股恒指等），计算超额收益、跟踪误差（可选）。
7. **导入工具**：常见券商对账单/成交明细 CSV 映射；失败行异常箱 + 可回滚。
8. **审计与可追溯**：**双分录/事件溯源**（见下）或至少交易不可变更审计日志；对账工具（现金/持仓核对）。

---

# 二、技术方案：选型与架构建议

**结论**：就你个人/小团队使用 + TS 栈，首选**Next.js 全栈单仓**方案（App Router + Route Handlers 暴露 REST API），数据库用 **SQLite + Prisma** 起步，后续平滑切换 Postgres。

- 优点：部署简单（单容器/单进程）、前后端类型共享、API 与页面一体化、shadcn/ui 与 Tailwind 4 无缝。
- 你要求 REST：Next.js 的 **Route Handlers** 足够，必要时加 **Zod** 校验，**OpenAPI** 自动生成。
- 若你以后要分离：保持\*\*“用例层/服务层”无框架\*\*的干净依赖，能无痛迁移到独立的 Fastify/NestJS。

**关键中间件与库**

- ORM：Prisma（SQLite 起步，migrate 管理）
- 校验：Zod（请求/响应 DTO + OpenAPI 生成）
- 鉴权：next-auth（本地/Passkey），仅本地自用也建议最小鉴权
- 作业调度：node-cron/next-cron（用于估值快照）
- 报表：xlsx / pdf-lib（导出 Excel/PDF）
- 图表：recharts
- UI：shadcn/ui + TailwindCSS 4.x
- 测试：Vitest + Playwright（端到端校验收益口径）

**数据安全**

- .env 分离密钥；数据库文件可开启文件层加密（sqlite 拓展或宿主机加密）
- 细粒度 RBAC（哪怕先支持“只有你自己”）
- 全量导出/备份脚本（定时）

---

# 三、数据模型（轻量 ER 概览）

```mermaid
erDiagram
  User ||--o{ Account : owns
  Account ||--o{ Transaction : has
  Account ||--o{ ValuationSnapshot : has
  Instrument ||--o{ Lot : has
  Account ||--o{ Lot : holds
  PriceFeed ||--o{ Price : provides
  FxRateFeed ||--o{ FxRate : provides

  User { uuid id }
  Account { uuid id, string name, string baseCurrency }
  Transaction {
    uuid id, uuid accountId, date tradeDate, string type,
    string instrumentId?, decimal quantity?, decimal price?,
    decimal cashAmount?, string currency, decimal fee?, decimal tax?,
    string lotId?, string note
  }
  Lot { uuid id, uuid accountId, uuid instrumentId,
        decimal qty, decimal costPerUnit, date openDate, string method }
  Instrument { uuid id, string symbol, string market, string currency, string type }
  ValuationSnapshot { uuid id, uuid accountId, date asOf,
    decimal totalValue, json breakdown }
  Price { uuid id, uuid instrumentId, date asOf, decimal close, string currency }
  FxRate { uuid id, string base, string quote, date asOf, decimal rate }
  Config { string key, json value, date effectiveFrom, date effectiveTo }
```

- **Transaction.type** 枚举示例：`CASH_IN|CASH_OUT|BUY|SELL|DIVIDEND|INTEREST|FEE|TAX|TRANSFER|FX_TRADE|OPTION_PREMIUM|EXERCISE`
- **Config** 存放“个税/社保/公积金/专项扣除”等**地区年度化参数**，带生效区间。

---

# 四、核心算法口径（实现要点）

## 1) 个税累计预扣（通用思路，参数化）

- 当月累计应纳税所得额 = 累计税前收入 − 累计三险一金个人缴纳 − 累计专项附加扣除 − 累计免税额（如 5000/月 × 月数）
- 当月应预扣个税 = （按累计应纳税额查表计算的税额） − 累计已预扣税
- 年终奖可选“并入综合所得”或“单独计税”（做成可选策略）。

**接口与计算流程**

```ts
type TaxParams = {
  city: string; year: number;
  brackets: { threshold: number; rate: number; quickDeduction: number }[];
  monthlyBasicDeduction: number; // 例：5000
  sihfRates: { pension: number; medical: number; unemployment: number; ... };
  sihfBase: { min: number; max: number };
  housingFund: { rate: number; baseMin: number; baseMax: number };
  specialDeductions: Record<string, number>; // 子女教育等每月额
};

function calcMonthlyWithholdingCumulative(
  months: { month: string; gross: number; bonus?: number; overrides?: Partial<TaxParams> }[],
  params: TaxParams
): { month: string; net: number; taxThisMonth: number; summary: any }[] {
  // 按月滚动，使用“累计应纳税额 - 累计已预扣”逻辑
  // params/overrides 支持城市、比例、基数切换
  return [];
}
```

> 注意：**不把税率写死**，税表、专项扣除做成可配置，并保留“计算快照 + 参数版本”。

## 2) 投资收益（TWR/MWR/XIRR）

- **TWR（日链式）**：在每个现金流时点**拆分区间**，区间收益率 `r_i = (V_end - Flow_i) / V_start - 1` ，全期 `TWR = Π(1 + r_i) - 1`。
- **MWR（XIRR）**：解贴现率 r，使 `Σ CF_t / (1+r)^{days/365} + EndingValue/(1+r)^{...} = 0`。
- **绝对收益额**：`PnL = EndingValue - StartingValue - NetContrib`。

**简版 TS 伪代码**

```ts
function xirr(
  cashflows: { date: Date; amount: number }[],
  guess = 0.1
): number {
  // Newton-Raphson，注意数值稳定与多根问题，必要时区间搜索 + 多初值
  return 0.0;
}

function twr(
  periods: { startValue: number; endValue: number; netFlowDuring: number }[]
): number {
  return (
    periods.reduce(
      (acc, p) => acc * ((p.endValue - p.netFlowDuring) / p.startValue),
      1
    ) - 1
  );
}
```

---

# 五、API 设计（REST 示例）

```
POST   /api/config/tax-params               // 创建/更新地区+年度税参
GET    /api/config/tax-params?city=...&year=...

POST   /api/income/monthly                  // 新增月收入（税前/奖金/专项扣除覆盖）
GET    /api/income/forecast?year=2025       // 全年预测（税前/税后/累计税）
GET    /api/income/summary?year=2025        // 已发生汇总

POST   /api/accounts                        // 新建账户（币种、名称）
POST   /api/transactions/import             // 批量导入（CSV 映射）
POST   /api/transactions                    // 单笔交易或现金流
GET    /api/accounts/:id/positions          // 当前持仓（含未实现/已实现）
GET    /api/accounts/:id/performance        // TWR/MWR/PnL 明细
POST   /api/valuations/snapshot             // 估值快照（可由 cron 触发）
GET    /api/portfolio/performance           // 组合级汇总（多账户、多币种）
```

**请求/响应统一 Zod 校验**；响应含 `calcVersion` 与 `paramsVersion` 以便追溯。

---

# 六、前端信息架构（React + shadcn/ui）

- **收入台账**：表单（城市、年份、月度明细、专项扣除），右侧即时净收入试算卡片；年度预测图（柱状：税前/税后/累计税）。
- **投资主页**：组合总览（资产曲线、净入金、TWR/MWR、回撤）、账户列表。
- **账户页**：

  - 顶部：市值、净入金、费税、收益额；
  - Tabs：持仓（含成本、均价、未实现）、交易流水、现金流水、分红、费用、对账；
  - 导入对话框（CSV 映射器 + 预览 + 错误行反馈）。

- **参数中心**：税参/社保/公积金/汇率维护（版本+生效期），支持复制上年参数。
- **审计与备份**：操作日志、导出按钮。

---

# 七、开发里程碑（建议 3 步）

1. **MVP（2–3 天）**

- 账户/交易/估值最小模型 + 导入器 V1
- 组合与账户层 **TWR/MWR/PnL** 计算
- 收入表单 + 简易个税累计预扣试算（参数硬编码 → 读取 Config）

2. **完善（1–2 周）**

- 税参/社保参数中心、专项扣除、年终奖策略
- Lot 管理、已实现/未实现分拆、费用/税费口径
- CSV 映射模板、错误箱、对账页；图表与导出

3. **进阶（可选）**

- 多币种 FX 管理、基准与超额、回撤与波动率
- 期权、分红再投、企业年金/商保抵扣
- 细粒度审计与回滚、作业计划与通知

---

# 八、你可以直接丢给 AI 的“超级提示词模板”

> 复制后只需把【方括号】里的参数替换为你的实际偏好/数据。

```
你是资深金融系统工程师与前端架构师。请用 TypeScript/Node.js + React (Next.js) + TailwindCSS 4 + shadcn/ui 生成一个“个人财富管理系统”的最小可用版本，并给出严谨的实现说明与代码片段。

## 业务范围
- 个人收入管理：按【城市=杭州】【年份=2025】采用“累计预扣法”，参数（社保/公积金/专项扣除/免税额）需从配置读取，支持版本与生效期；支持工资、季度/年终奖（并入/单独计税可选），实时计算月度税后与全年预测。
- 投资管理：多账户/多币种，交易与现金流记账，按日估值快照；计算 TWR、MWR(XIRR)、绝对收益额、净入金；支持分红/费用/税费/汇兑；Lot(FIFO) 维持已实现/未实现盈亏。

## 架构与标准
- Next.js App Router 单体；Route Handlers 暴露 REST；请求/响应用 Zod 校验并导出 OpenAPI。
- 数据库：Prisma + SQLite（保留迁移脚本，未来可切 Postgres）。
- 模块：config(税参/汇率)、income、accounts、transactions、positions、valuations、importer、audit。
- 提供：ER 图、Prisma schema、核心接口（见下）、关键算法（累计预扣、TWR/MWR）TS 实现。
- 前端：pages（收入、参数、投资总览、账户详情），表单组件、CSV 导入器（字段映射 + 预览）。
- 测试：Vitest（税务与收益口径单元测试），Playwright（导入-计算-展示端到端）。
- 安全：最小鉴权（next-auth，本地用户），.env 样例与 Dockerfile/compose。

## 关键接口
- POST /api/config/tax-params
- POST /api/income/monthly, GET /api/income/forecast
- POST /api/accounts
- POST /api/transactions, /api/transactions/import
- POST /api/valuations/snapshot
- GET  /api/accounts/:id/performance, /api/portfolio/performance

## 算法要求
- 累计预扣：按“累计应纳税所得额 → 查表 → 减累计已扣”的通用流程，税表、扣除与社保/公积金从 Config 读取，且带参数版本。
- TWR：现金流时点切分区间，链式乘积；MWR：XIRR（Newton-Raphson + 容错）。
- 输出需包含 PnL、净入金、回撤、分红、费用拆解。

请给出：目录结构、关键代码片段（Prisma schema、Route Handlers、算法实现）、前端页面骨架与组件示例、测试样例，以及后续扩展建议。
```

---

# 九、实现细节片段（示例）

**Prisma（节选）**

```prisma
model Account {
  id           String  @id @default(uuid())
  name         String
  baseCurrency String  @default("CNY")
  createdAt    DateTime @default(now())
  transactions Transaction[]
  lots         Lot[]
  snapshots    ValuationSnapshot[]
}

model Transaction {
  id         String   @id @default(uuid())
  accountId  String
  type       String   // enum in app
  tradeDate  DateTime
  instrumentId String?
  quantity   Decimal?
  price      Decimal?
  cashAmount Decimal?  // +in/-out
  currency   String
  fee        Decimal?  @default(0)
  tax        Decimal?  @default(0)
  lotId      String?
  note       String?
  account    Account  @relation(fields: [accountId], references: [id])
  createdAt  DateTime @default(now())
}

model Config {
  id            String  @id @default(uuid())
  key           String
  value         Json
  effectiveFrom DateTime
  effectiveTo   DateTime?
  createdAt     DateTime @default(now())
}
```

**收益计算入口（节选）**

```ts
// 汇总到基准币种
function toBase(
  amount: number,
  ccy: string,
  date: Date,
  fx: FxProvider,
  base = "CNY"
) {
  return ccy === base ? amount : amount * fx.rate(ccy, base, date);
}
```

---

# 十、经验性建议与注意事项

- **先定口径后编码**：收益、个税口径一旦变更，测试与历史数据都会受影响。先把定义写进代码注释与测试里。
- **数据可追溯**：交易/估值/参数都要留“版本 + 时间戳”；报表展示用“计算版本号”。
- **导入优先**：实际使用中，导入器质量决定你是否愿意长期使用这套系统。
- **多币种早规划**：即使短期只用 CNY，模型也提前留 currency 字段与 FX 接口。
- **别把税表写死**：全部从 Config 读，保证来年只需改配置。
