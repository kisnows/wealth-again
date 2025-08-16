## 010: 估值快照历史与分页

**目标**: 估值快照页面下方展示历史记录，默认按时间倒序，超过 50 行分页显示（API 已支持，补测试与前端提示）。

**成功标准**:

- `/api/accounts/[id]/snapshots` GET 的分页逻辑有单测覆盖；
- 前端 `AccountDetail` 在快照 Tab 显示分页信息，并在总数较大时可翻页；
- 断言当记录数超过 50 时分页按钮状态正确。

**子任务**:

1. 测试
   - 新增 `src/tests/snapshots.test.ts`：构造 120 条快照，断言三页返回。
2. 前端优化
   - 在 `AccountDetail` 快照表格下方增加总数/页码提示（现已部分实现，补总数文案）。

**测试命令**:

```bash
pnpm test -- src/tests/snapshots.test.ts
# 或
npx -y vitest run src/tests/snapshots.test.ts
```

**状态**: Completed
