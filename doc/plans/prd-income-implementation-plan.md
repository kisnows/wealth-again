# PRD-Income v1.1 落地改造计划（实现全量功能）

## 目标

- 覆盖 doc/prd-income.md 的全部计算与配置能力：工资/奖金/长期现金、社保/公积金、年度累计个税，支持“当月生效、同月多次变更取最后一次”。
- 提供配置化城市规则与税制（含月度基本减除与专项附加扣除），保证任何月份可重算与对账。
- 页面专业、精简高效，支持规则维护、回算入口与收入快照/时序展示。

## 差距与改造点

1. 工资“当月生效”未正确实现（现按 <= 月首天）；需改为 < 次月月首（同月内生效）。
2. 社保缺少“医保固定额（个人）”，现仅按比例汇总。
3. 税务配置缺少“专项附加扣除（月）”。
4. IncomeRecord 缺少对账字段：累计应税、累计应纳税额。
5. 规则维护页面/接口缺口：

   - 税制页面需新增专项附加扣除输入。

6. 记录展示需补充对账字段，提升可读性与格式化。

## 技术方案

- 数据层（Prisma）
  - TaxConfig 新增字段：`specialAdditionalDeduction: Decimal?`（专项附加扣除/月）。
  - IncomeRecord 新增：`taxableCumulative: Decimal?`, `taxCumulative: Decimal?`。
- 服务层
  - 收入回算：
    - 工资：按 `effectiveFrom < nextMonthStart` 取最新一条。
    - 社保：`pension = base*pensionRate`；`medical = base*medicalRate`；`unemployment = base*unemploymentRate`；合计为社保个人。
    - 公积金：`housing = base*rateEmployee`。
    - 应税当期：`monthIncome - social - housing - standard - specialAdditional`；<=0 归零。
    - 调用税表累计计算，写回当月个税、累计已缴，同时写回累计应税与累计应纳税额。
- API 层
  - `/rules/tax/config` PUT：接收并持久化 `specialAdditionalDeduction`。
- 前端
  - 规则页面：
    - 税制：增加“专项附加扣除（月）”输入框。
  - 收入快照：新增列“当期应税、累计应税、累计应纳税、累计已缴”，金额格式化。
- 数据初始化（可选）
- 测试
  - 新增基于 PRD 1–3 月样例的断言：社保=2103，公积金=2400，税额与净发放与文档一致。
  - 新增“同月多次变更取最后一次”的校验。

## 验收标准

- 输入文档示例参数，回算 1–3 月：当月个税与净发放等数值与文档一致；`taxableCumulative/taxCumulative/taxPaid` 内部自一致。
- 规则与税制页面可维护新增字段；接口具幂等校验且区间重叠校验继续有效。
- 收入快照页面展示新增对账字段，交互流畅、格式清晰。

## 风险与回滚

- Prisma 迁移：一次性字段新增，向后兼容（默认 0/NULL）；如异常可回滚迁移并保留旧逻辑。
- 税务计算变更只增加扣除项与固定额，不影响旧用例（默认值为 0 兼容）。

---

实施顺序

1. 数据模型与迁移 → 2) 服务层计算修复 → 3) API 扩展 → 4) 前端页面更新 → 5) 测试补充 → 6) 本地运行与验收。

## 自我审查与调整记录（v1）

- 业务一致性：
  - 工资当月生效、同月取最后一次：已在服务层以 `< nextMonthStart` 实现，满足 PRD。
  - 医保固定额（个人）与专项附加扣除：已入库、计算、页面可维护，满足 PRD 示例。
  - 个税累计法与阈值/速算扣除：沿用已有税表，补充 `cumulativeTaxable/cumulativeTax` 回填，支持对账。
- 技术合理性：
  - 字段新增均向后兼容（默认 0/NULL），不破坏现有接口。
  - 前端最小改动覆盖新增字段，保持 UI 简洁一致（shadcn/ui + Tailwind）。
- 风险与兜底：
  - Prisma 迁移需在本地执行：`npx prisma migrate dev`；如失败可回滚，数据兼容。
  - 税前端口入参与显示均支持 NULL→0 的显示，避免旧数据空值导致页面异常。

审查结论：方案满足业务与技术预期，无需再修订。
