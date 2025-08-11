# 添加通用格式化工具（formatCurrency/formatPercentage）

## 背景

- 运行开发服务器时多处报错：`formatCurrency` 未从 `@/lib/utils` 导出，导致页面 500。
- 组件影响：`src/app/dashboard/page.tsx`、`src/components/income/income-form.tsx`、`src/components/income/income-summary.tsx`、`src/components/investment/performance-chart.tsx`。

## 子任务清单

1. 在 `src/lib/utils.ts` 中实现并导出 `formatCurrency`、`formatPercentage`。
2. 为上述函数添加单测：`src/tests/utils.test.ts`。
3. 启动 dev，确认页面/接口不再因该错误报 500。
4. 运行单测：`npm run test`。

## 验证与测试

- 手动：访问 `/`、`/dashboard`、`/income` 确认页面渲染正常。
- 自动：执行 `npm run test`，所有测试通过。
