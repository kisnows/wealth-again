# 测试追踪矩阵（子系统关键用例）

目的：为各子系统的“关键最小用例”建立可勾选的追踪矩阵，统一记录状态、测试文件、断言要点与责任人，保证分阶段改造在 CI 中可见、可核验。

使用方式：
- 在每个用例行的“状态”列更新 TODO/WIP/PASS/FAIL/BLOCKED/SKIPPED。
- 在“PR/链接”列附上相关 PR 编号或 CI 链接。
- 优先在既有测试文件中补充断言，避免重复文件。

状态说明：
- TODO：未开始；WIP：开发中；PASS：稳定通过；FAIL：失败；BLOCKED：被前置依赖阻塞；SKIPPED：阶段未启用。

---

## 阶段里程碑追踪（PR 级）

- [ ] PR-001 schema: FxRateSnapshot + TxnLine/IncomeRecord 字段（nullable）
- [ ] PR-002 目录化：services/accounts-ledger、services/income-tax（不改逻辑）
- [ ] PR-003 fx/provider 接入写路径（entries 写入 fxSnapshotId/baseToDisplayRate）
- [ ] PR-004 EventOutbox 模型 + writer（同事务）
- [ ] PR-005 本地 queue/worker（income-recalc）
- [ ] PR-006 Outbox consumer → Reporting 物化视图
- [ ] PR-007 AuditLog 模型 + audit 接口与 UI 钩子

> 注：以上与 `doc/system-boundary-plan.md` 的“改造大步骤”一致，可在合并时勾选。

---

## Accounts & Ledger 关键用例

| ID | 场景 | 断言要点 | 测试文件 | 状态 | 负责人 | PR/链接 |
|---|---|---|---|---|---|---|
| AL-01 | 跨币种转账写入 fx 快照 | TxnLine 含 fxEffectiveAt/baseToDisplayRate 或 fxSnapshotId；借贷金额匹配；余额正确 | `src/tests/entries.*.test.ts` | TODO |  |  |
| AL-02 | 幂等存款 | 相同 Idempotency-Key 仅一条 TxnLine；第二次不重复写入 | `src/tests/ledger.routes.test.ts` | TODO |  |  |
| AL-03 | 归档账户禁止交易 | 归档后交易被拒；无新增 TxnLine | `src/tests/accounts.service.test.ts` | TODO |  |  |
| AL-04 | 估值快照与曲线 | ValuationSnapshot 存 fx 快照；曲线点与时间戳正确 | `src/tests/valuations.routes.test.ts` | TODO |  |  |
| AL-05 | 权限隔离 | U1 无法访问 U2 的账户/交易 | `src/tests/accounts.api.test.ts` | TODO |  |  |

---

## Income & Tax 关键用例

| ID | 场景 | 断言要点 | 测试文件 | 状态 | 负责人 | PR/链接 |
|---|---|---|---|---|---|---|
| IT-01 | PRD 示例 1–3 月回算 | 社保=2103、公积金=2400、对账字段匹配示例；多次回算一致 | `src/tests/income.prd-example.test.ts` | TODO |  |  |
| IT-02 | 工资变更当月生效（同月取最后一次） | 累计预扣正确、对账字段单调 | `src/tests/income.service.test.ts` | TODO |  |  |
| IT-03 | 奖金/长期现金/股权累计预扣 | clamp/专项附加扣除/医保固定额生效 | `src/tests/income.service.test.ts`, `src/tests/tax.service.test.ts` | TODO |  |  |
| IT-04 | 年度税务策略（TaxFxPolicy） | paymentDate vs yearEnd/annualAverage 结果稳定且有记录 | `src/tests/tax.service.test.ts` | TODO |  |  |
| IT-05 | 重算任务队列（阶段2） | 任务状态 queued→running→completed/failed；幂等 | `src/tests/income.recalc-task.service.test.ts` | SKIPPED |  |  |

---

## FX & Market Data 关键用例

| ID | 场景 | 断言要点 | 测试文件 | 状态 | 负责人 | PR/链接 |
|---|---|---|---|---|---|---|
| FX-01 | 时间点报价与不可变快照 | 同 base/target/at 返回相同 snapshotId；correction 产出新 snapshot | `src/tests/fx.service.test.ts` | TODO |  |  |
| FX-02 | 最新报价与时间序列 | latest 为最近；timeSeries 处理缺口 | `src/tests/fx.service.test.ts` | TODO |  |  |
| FX-03 | 缓存与降级 | provider 不可用时缓存/错误策略正确并可观测 | `src/tests/fx.service.test.ts` | TODO |  |  |

---

## Reporting & Analytics 关键用例

| ID | 场景 | 断言要点 | 测试文件 | 状态 | 负责人 | PR/链接 |
|---|---|---|---|---|---|---|
| RP-01 | Dashboard 汇总正确性 | 汇总与 TxnLine/IncomeRecord 快照一致（不用实时 FX） | `src/tests/reports.api.test.ts` | TODO |  |  |
| RP-02 | 收入时序准确性 | timeseries 与 IncomeRecord 聚合一致 | `src/tests/reports.api.test.ts` | TODO |  |  |
| RP-03 | Outbox→物化视图（阶段3） | 消费后报表一致，延迟在阈值内 | `src/tests/reports.api.test.ts` | SKIPPED |  |  |

---

## Identity & Audit 关键用例

| ID | 场景 | 断言要点 | 测试文件 | 状态 | 负责人 | PR/链接 |
|---|---|---|---|---|---|---|
| IA-01 | 用户信息与鉴权 | 登录返回 profile；未登录 401 | `src/tests/user.profile.api.test.ts` | TODO |  |  |
| IA-02 | 敏感操作审计（阶段3） | 审计写入 AuditLog；权限控制 | `src/tests/rules.api.test.ts`（+ `audit.*.test.ts` 如需） | SKIPPED |  |  |

---

## Jobs & Event Bus 关键用例

| ID | 场景 | 断言要点 | 测试文件 | 状态 | 负责人 | PR/链接 |
|---|---|---|---|---|---|---|
| JB-01 | 入队与执行（阶段2） | 任务状态流转、结果落库、失败重试/死信 | `src/tests/income.recalc-task.service.test.ts` | SKIPPED |  |  |
| JB-02 | Outbox 投递顺序与去重 | 顺序消费、重复事件幂等 | `src/tests/outbox.test.ts`（建议新增） | SKIPPED |  |  |

---

## 备注与操作指引

- 建议：阶段 2/3 的用例先标记为 SKIPPED，随阶段推进启用。
- 对于断言要点，可在对应测试中加入注释，便于 code review 识别测试目的。
- 若测试新增了 seed/mock 数据，请更新 `prisma/seed.js` 或在测试内部构造最小 fixture，并在本表“备注”列标注。