# 唯一账户名与账户详情页（005）

## 目标

- 同一用户下账户名唯一；重复创建返回 409，并在前端提示。
- 为投资管理新增账户详情页基础视图（快照列表）。

## 子任务

1. [x] Prisma `Account` 增加唯一约束：`@@unique([userId, name])`
2. [x] API `POST /api/accounts` 创建前查重，重复返回 409
3. [x] 前端 `AccountManager` 处理 409 并展示错误
4. [x] 新增 `GET /investment/accounts/:id` 详情页（快照表格）
5. [x] 新增测试 `src/tests/accounts.test.ts`
6. [ ] 迁移与测试执行

## 测试命令

```
npx prisma generate
npx prisma migrate dev --name unique_account_name
npm run test
```

## 验收

- 重复账户名创建返回 409，前端提示“账户名已存在”。
- 单元测试通过。
- 账户卡片“查看详情”跳转到详情页并显示快照（若有）。
