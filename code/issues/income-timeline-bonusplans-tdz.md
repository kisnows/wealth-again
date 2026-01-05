## Stage 1: 复现与定位
**Goal**: 复现 `/api/v1/reporting/income/timeseries` 500，并定位到 `income-timeline.ts` 中 `bonusPlans` TDZ（同名解构变量遮蔽 schema 表）。
**Success Criteria**: 明确报错点为 `Cannot access 'bonusPlans' before initialization` 且定位到 Promise.all 解构与 `.from(bonusPlans)` 同作用域。
**Tests**: `pnpm test src/tests/outbox.service.test.ts`（快速 sanity）
**Status**: Complete

## Stage 2: 修复 TDZ（变量重命名/别名）
**Goal**: 避免同名遮蔽：将 schema 的 `bonusPlans` 别名为 `bonusPlansTable`，将查询结果解构为 `bonusPlanRows`。
**Success Criteria**: `/api/v1/reporting/income/timeseries` 不再因 TDZ 抛 ReferenceError。
**Tests**:
- `pnpm test src/tests/income.timeline.service.test.ts`
**Status**: In Progress

## Stage 3: 回归测试
**Goal**: 增加单测覆盖 `buildIncomeTimeline` 能正常执行（至少不抛 TDZ 错误）。
**Success Criteria**: 新增测试用例通过，且在未修复版本会失败（ReferenceError）。
**Tests**:
- `pnpm test src/tests/income.timeline.service.test.ts`
**Status**: Not Started


