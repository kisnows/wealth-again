# 账户详情多 Tab：现金流/交易/快照/绩效（006）

## 目标

- 在 `/investment/accounts/:id` 实现多 Tab：
  - 现金流：新增/查看 `CASH_IN`/`CASH_OUT`
  - 交易：查看历史交易（后续可新增与导入）
  - 快照：新增/查看估值快照
  - 绩效：展示 TWR/MWR/PnL/净入金（调用现有 API）
- 后端补充：`GET /api/transactions?accountId=...&type=...` 列表接口。
- 单测：`GET /api/transactions` 基本正确性。

## 子任务清单

1. [x] 新增接口：`GET /api/transactions`
2. [x] 新增组件：`src/components/investment/account-detail.tsx`（客户端，多 Tab）
3. [x] 改造页面：`/investment/accounts/[id]/page.tsx` 引用新组件
4. [x] 表单：新增现金流与估值快照；表格列表：交易、现金流、快照
5. [x] 图表：绩效线（用快照，接口取 `GET /api/accounts/:id/performance`）
6. [x] 单测：`src/tests/transactions.test.ts`（插入一条交易并查询）
7. [ ] 运行测试：`npm run test`

## 测试命令

```
npm run test
```

## 验收

- 在账户详情页能添加现金流与估值快照；能查看交易与现金流列表；绩效卡片显示 TWR/MWR/PnL。
