# 修复 JSON 字段与账户列表接口缺口（004）

## 背景

- `Config.value` 与 `ValuationSnapshot.breakdown` 在 Prisma 中为 `String`，路由层直接写入对象会产生运行时错误。
- 前端多处调用 `GET /api/accounts` 获取账户列表，但后端仅实现了 `POST /api/accounts`。

## 子任务清单

1. [x] 将 Prisma 模型字段改为 `Json` 类型：
   - `Config.value: Json`
   - `ValuationSnapshot.breakdown: Json`
   - `IncomeRecord.overrides: Json?`
2. [x] 修正税参相关路由读写：
   - `src/app/api/config/tax-params/route.ts`
   - `src/app/api/config/tax-params/refresh/route.ts`
   - `src/app/api/income/forecast/route.ts`
   - `src/app/api/income/summary/route.ts`
3. [x] 新增 `GET /api/accounts` 返回账户列表。
4. [x] 在 `src/lib/tax.ts` 新增 `normalizeTaxParamsValue` 并应用于收入路由。
5. [x] 修正 `package.json` 包名为 `wealth-again`。
6. [x] 新增单测 `src/tests/tax-normalize.test.ts`。
7. [ ] 数据库同步与测试：
   - 生成客户端：`npx prisma generate`
   - 迁移（失败则回退 db push）：`npx prisma migrate dev --name json_fields` 或 `npx prisma db push`
   - 运行单测：`npm run test`

## 验证标准

- `GET /api/accounts` 返回 `{ accounts: [...] }`。
- 税参路由不再依赖 `JSON.parse/stringify`；`income` 相关接口正常返回。
- `npm run test` 全部通过。

## 相关测试命令

```
# 生成 Prisma 客户端
npx prisma generate
# 尝试迁移（若失败改用 db push）
npx prisma migrate dev --name json_fields || npx prisma db push
# 运行所有单测
npm run test
```
