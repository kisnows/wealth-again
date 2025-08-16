## 011: 收入管理表单与年度汇总测试补齐

**目标**: 完整覆盖收入表单/汇总/预测的关键路径测试，确保 README 中表单、预测、汇总均可用。

**成功标准**:

- 增加端到端层级的接口测试：
  - 新建工资变更、奖金计划 → 预测接口出现对应标注；
  - 计算接口 `/api/income/calculate` 能写入并读取年度汇总数据；
  - 汇总页 `/income/summary` 的 API 数据（非 UI）计算可靠。

**子任务**:

1. API 集成测试
   - 新增 `src/tests/income-integration.test.ts` 覆盖上述流程（已完成）。
2. 文档
   - 在 README 中补充“运行测试”和“关键 API”章节（单独任务跟进）。

**测试命令**:

```bash
pnpm test -- src/tests/income-integration.test.ts
# 或
npx -y vitest run src/tests/income-integration.test.ts
```

**状态**: Completed
