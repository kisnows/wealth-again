## 008: 收入记录与历史追踪的生效时间对齐

**目标**: 所有收入记录（工资与奖金）按照自然月最后一天生效，历史记录持久化且查询支持分页，前端页面展示标注完整。

**成功标准**:

- `/api/income/monthly` 在 upsert 当月记录的同时，`IncomeChange.effectiveFrom` 统一落在该月最后一天（已实现但需测试覆盖）。
- `/api/income/bonus` 的创建/查询保留 `effectiveDate`，并在前端标注为“月末发放”。
- `/api/income/changes` 与 `/api/income/bonus` GET 均支持分页（已实现，补充测试）。

**子任务**:

1. API 覆盖测试
   - 新增 e2e/集成测试：
     - POST `/api/income/monthly` 不传生效日 → 自动设置到当月最后一天；
     - POST `/api/income/bonus` → 生效日期统一归一为当月最后一天；查询到记录且分页正确；
     - GET `/api/income/changes` 默认城市/分页行为稳定。
2. 前端标注
   - `src/app/(dashboard)/income/page.tsx` 在表格列名或注脚提示“按月末生效”。

**测试命令**:

```bash
pnpm test -- src/tests/income-history.test.ts
# 或
npx -y vitest run src/tests/income-history.test.ts
```

**状态**: Completed
