# 财富管理平台 TDD 测试蓝图

> 参考 `doc/prd.md`、`doc/prd-income.md`、`doc/tech.md`、`doc/frontend-constraints.md`、`doc/ui-routing.md`、`doc/plans/prd-income-implementation-plan.md`

## 1. 目标与范围
- 以测试驱动方式覆盖资产、账户、收入、规则、报表、权限、管理员模拟登录等关键能力，确保核心路径 100% 覆盖。
- 单元与集成测试统一落在 `src/tests`，使用 Vitest；后续端到端流程以 Playwright 扩展。
- 种子数据复用 `prisma/seed.ts` 与 `doc/data.md` 的杭州 2023-2025 样例，保证跨年社保/公积金/个税规则测试一致。

## 2. 测试分层策略
- **工具/纯函数**：`src/lib/domain/*`、`src/lib/utils/*`，重点验证金额格式化、区间校验、日期工具。
- **服务层集成**：`src/server/services/*`，使用 Prisma Test Client 校验数据库交互、事务、一致性、幂等。
- **API Route Handler**：`src/app/api/**`，通过 `supertest + createNextHandler` 模拟请求，覆盖权限、校验、响应码。
- **前端模块**：`components/modules/*`、`components/ui/*`，React Testing Library + Vitest 验证交互与状态联动。
- **端到端（规划）**：Playwright 跑关键用例（登录→Dashboard、账户流水、收入回算、管理员模拟登录、规则维护）。
- **命名规范**：测试文件统一为 `模块.层级.test.ts`，示例：`income.api.test.ts`、`accounts.service.test.ts`；同一模块下的 API/Service/UI/Utils 测试保持并列命名，避免拆成多个碎片文件。
- **写作要求**：在 `describe` 与 `it` 前使用中文注释描述测试目的与预期；共享 mock/fixture 应集中在 `beforeEach`/`beforeAll` 中重置，保证跨用例隔离。

## 3. 测试基线准备
1. **数据库**：在 `vitest.setup.ts` 中配置测试数据库（`file:./dev-test.db`），`beforeAll` 执行 `prisma migrate deploy`，`beforeEach` 清空表。
2. **夹具**：封装 `seedIncomeFixtures()` 写入工资/奖金/LTC/股权样例；`makeUserWithCity()` 创建带杭州规则的测试用户。
3. **断言工具**：提供 `expectMoneyEqual`、`expectDateEqual`，对齐金额精度与时区。
4. **身份模拟**：`createUserSession(role, impersonatedUserId?)` 返回 NextAuth session，便于 Route Handler 测试。

## 4. 功能域测试详单

### 4.1 身份认证与权限
1. 登录接口返回 USER/ADMIN 角色 session；禁用未激活用户。
2. `getServerSession` 在账户/收入/报表接口上拒绝未登录访问。
3. 管理员模拟登录：`/api/admin/impersonate` 写入 `ImpersonationSession`，退出接口清理记录。
4. 审计日志：模拟登录、规则维护、人工调整、账户操作均写入 `AuditLog`，校验 `actorId` 与 `asUserId`。
5. 前端 `ImpersonationBanner` 组件在存在 `impersonatedUserId` 时渲染提醒，可触发“退出模拟”。
6. 权限回归：普通用户访问他人数据返回 403，管理员附带 `userId` 查询成功。

### 4.2 账户管理（优先）
1. 账户 CRUD：创建时写入审计与幂等键；更新禁止 `baseCurrency` 变更；归档接口切换状态。
2. Timeseries：
   - 估值序列：`valuationSnapshot` 聚合；测试空数据返回空数组。
   - 本金序列：过滤 `to` 日期之后的分录；空档补零。
3. 记账接口：
   - `deposit/withdraw`：账户存在校验、幂等处理、余额更新。
   - `transfer`：跨币种时调用 `fx.convert`，写入双边分录，重复幂等键返回 409。
4. 报表：`report.getAccountSummary` 按账户类型聚合余额与收益率；归档账户默认排除。
5. 前端 `AccountTable`：加载态、空态、筛选、批量选择交互。

### 4.3 收入管理（优先）
1. 工资变更：
   - `getMonthlySalary` 采用 `< nextMonthStart` 策略，同月多条取最后一次。
   - 跨币种工资保留 `sourceCurrency` 与 FX rate。
2. 奖金：
   - 计划写入成功并在支付月并入工资计税。
   - 速算扣除表跨档测试（36k→144k）。
3. 长期现金（LTC）：
   - 计划生成默认 16 期季度 payout；自定义金额后总额保持一致。
   - `incomeRecord.ltcIncome` 正确更新。
4. 股权：
   - Grant 生成 vest 日程；更新 vest `fairValue` 影响当月收入；未来月份 `isForecast` 标记。
5. 社保/公积金：
   - `CityRuleSS/HF` 按生效日期切换上下限；
   - 医保固定额 +3 元；
   - 基数 `clamp` 测试（工资低于/高于上下限）。
6. 个税累计预扣：
   - 对照 `doc/prd-income.md` 2025-01~03 示例：社保 2103、公积金 2400、个税金额匹配。
   - 当期应税为负时自动归零。
   - `taxableCumulative`、`taxCumulative`、`taxPaidCumulative` 递增且可回推。
7. 人工调整：
   - `manualGross/manualNet/manualIncomeTax` 覆盖计算值；
   - `manualComment` 保留；
   - 回算时人工值优先。
8. 年度回算：
   - `income.recalc(year, month)` 重算 1..N 月；
   - 回算后触发 `incomeRecord.upsert`；
   - 预测月份 `isForecast` 保持不变。
9. 前端：
   - `IncomeRecordsTable` 显示人工调整 Tag；
   - 年度切换刷新数据；
   - CSV 导出包含税前/税后/社保/公积金/个税/人工字段。

### 4.4 规则维护
1. 社保、公积金区间不重叠校验；`baseMin <= baseMax`。
2. 税制配置更新 `specialAdditionalDeduction`；`TaxBracket` 排序与覆盖。
3. 批量导入 JSON 校验字段完整性与重复。
4. 管理员权限限制；操作写入审计。

### 4.5 报表
1. `report.getDashboard` 聚合资产/负债/净资产/收入摘要，FX 折算正确。
2. `report.getIncomeTimeseries` 区分实际/预测；汇总 bonus/ltc/equity。
3. 税务报表：年度有效税率 = `税额 / 税前收入`。
4. 导出 CSV 金额格式统一。

### 4.6 设置模块
1. 基准币种/展示币种切换写入 `UserPrefs` 并触发 SWR `mutate`。
2. 工作城市切换：新月份应用新规则。
3. 专项附加扣除维护：新增/更新/删除影响后续回算。
4. 通知偏好默认值与保存。

### 4.7 管理员工作台
1. `/admin/users` 列表：净资产、收入摘要、搜索过滤。
2. 模拟登录按钮触发成功；Banner 显示并可退出。
3. `/admin/activity` 按时间倒序展示 `AuditLog`，支持 `action` 过滤。
4. 非管理员访问 403 并记录审计。

## 5. 工具与自动化
- `package.json` 增加 `test:watch`、`test:ci`；Vitest + c8 输出覆盖率。
- 覆盖率阈值：语句/函数/分支 ≥ 90%，关键服务（收入、账户） ≥ 100%。
- Git Hook：pre-commit 执行 `npm run lint && npm run test -- --runInBand`。

## 6. 迭代里程碑
1. **Sprint 1**：完成账户 + 收入服务测试夹具、回算示例、幂等校验。
2. **Sprint 2**：扩展规则维护、报表聚合、设置模块测试。
3. **Sprint 3**：前端模块测试与端到端 Playwright 冒烟。
4. **Regression**：以 `doc/prd-income.md` 示例数据跑全量测试，确保数值一致。

## 7. 附录
- Fixtures：`seedIncomeFixtures`、`makeUserWithCity`、`mockFxRate`。
- 常量：标准扣除 5000，专项附加默认 0，可在夹具中覆盖。
- 注意：测试中严禁依赖真实 API/GitHub/网络；全部通过内存/SQLite 仿真。
