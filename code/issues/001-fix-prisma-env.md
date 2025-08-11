# 修复 Prisma 环境错误（DATABASE_URL 缺失）

## 背景

- 运行 `npm run dev` 时，`/api/config/tax-params` 报错 `PrismaClientInitializationError: Environment variable not found: DATABASE_URL`。
- 本项目使用 SQLite，需在 `.env` 中配置 `DATABASE_URL`，格式应为 `file:./dev.db`。

## 子任务清单（进度）

1. [x] 在项目根目录创建或修正 `.env`，设置 `DATABASE_URL=file:./dev.db`。
2. [x] 运行 Prisma 客户端生成：`npx prisma generate`。
3. [~] 初始化并应用迁移：`npx prisma migrate dev --name init`。
   - 说明：本机执行时 `schema-engine` 被 SIGKILL 终止，改用 `npx prisma db push` 完成结构同步。
   - 实际执行：`npx prisma db push`
4. [x] 启动或重启开发服务器验证不再报错（预期若无记录返回 404 而非 500）。
   - 验证命令：`curl -i http://localhost:3000/api/config/tax-params?city=Hangzhou&year=2025`
   - 期望：404 Not Found（无记录时），不应返回 500。
5. [x] 运行单测验证不受影响：`npm run test`。

## 验证与测试

- 手动验证：
  - 接口：`GET /api/config/tax-params?city=Hangzhou&year=2025`
  - 命令（端口重定向至 3001）：`curl -i http://localhost:3001/api/config/tax-params?city=Hangzhou&year=2025`
  - 结果：返回 200 JSON（此前通过脚本写入一条配置），未出现 `DATABASE_URL` 相关 500。
- 自动化测试：
  - 单元测试命令：`npm run test`
  - 结果：全部通过。

## 遗留/后续

- `POST /api/config/tax-params` 在 3001 端口测试时返回 404（页面 NotFound）。`GET` 已正常，说明路由存在但 POST 被错误地路由到页面层。
- 需新开任务排查：可能与 Next.js 开发服务器多端口切换/热重载状态有关，或请求构造/头部在终端下被 shell 插值破坏导致路由匹配失败。
- 临时可用替代：使用 `scripts/test-config.ts` 通过 Prisma 直接写入配置，或在页面层提供参数提交表单。

## 变更记录

- 新增：`code/issues/001-fix-prisma-env.md`
- 配置：修正 `.env` 的 `DATABASE_URL`。
- 数据库：初始化 SQLite 数据库并应用初始迁移。
