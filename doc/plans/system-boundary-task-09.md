# 系统边界改造任务 09：FX Provider 封装与缓存策略

## 完成内容概览

- 将原有 `src/server/services/fx.ts` 拆分为 `fx/provider.ts`，构建统一的 `FxProvider`，公开 `getQuote`、`getLatestRates`、`getTimeSeries`、`ensureFxSnapshot*`、`convert` 等入口，并集中处理缓存与回退逻辑。
- `fx.ts` 现仅作为适配层重导出 provider API，历史调用保持兼容，同时保证所有业务逻辑经 provider 间接访问 Prisma。
- 账本、估值、收入、报表及相关 API 路由改为直接引用 `@/server/services/fx/provider`，移除对 Prisma delegate 的直接依赖。
- Worker/服务层仍写入 FX 快照；provider 内部提供 5 分钟 TTL 的 Promise 缓存（可通过 `setConfig` 或 `clearFxCache` 调整），涵盖报价、最新价与时序查询。
- 为缺失汇率的严格场景保留审计日志 `FX_RATE_MISSING` 写入；宽松场景（如兑换目标为 USD）支持降级返回 1 倍率。

## 缓存与降级策略

- **缓存层**：使用内存 Map + Promise 复用避免并发重复请求；默认 TTL 5 分钟，可在运行期通过 `fxProvider.setConfig({ cacheTtlMs })` 调整。
- **报价获取 (`getQuote`)**：按 `base/quote/asOf/allowMissing` 组合缓存；allowMissing 为 `false` 时缺失记录会触发审计并抛错。
- **最新汇率 (`getLatestRates`)**：缓存排序后的请求集合；返回值按调用方请求顺序输出，并为缺失币种填充 `null`。
- **时序 (`getTimeSeries`)**：基于 `base/quote/from/to` 缓存，返回按生效时间升序的区间片段。
- **快照 (`ensureFxSnapshot`/`Batch`)**：保留唯一约束回退与幂等逻辑；写入失败会清理缓存并抛出异常。
- **降级策略**：当允许缺失（USD 目标）时返回 `null`/单位汇率，避免阻断流程；其他情况写入审计日志并向上抛错。

## 测试与验证

- `src/tests/fx.service.test.ts` 增补 provider 专用用例：缓存命中、`getTimeSeries` 输出、`getLatestRates` 缺失币种顺序等。
- 现有 API/路由/服务测试已更新至新路径，并 mock provider 接口以保持隔离。
- `npm test` 全量通过（133 项）。

## 使用指引

- 代码层通过 `import { fxProvider, getQuote, convert } from "@/server/services/fx/provider"` 获取功能；若需清理缓存，可调用 `fxProvider.clearCaches()` 或重导出的 `clearFxCache()`。
- 运行时如需调整 TTL，可读取环境变量包装后调用 `fxProvider.setConfig({ cacheTtlMs })`；暂未内置自动读取，避免隐藏配置。
- 对外 API `/api/v1/fx/rates/latest` 仍返回原结构，但底层已走 provider 缓存，可根据需要增加前端轮询/失效策略。

## 后续关注

- 若需要跨进程缓存，可在 provider 增加可插拔存储实现（Redis 等），当前实现保留扩展钩子。
- 时序接口目前直接读取 `FxRate` 表，若后续引入更长区间，可考虑分页或限制查询窗口。
- 需与 Task-07/08 的 Outbox / 报表结合评估：若 Fx 事件未来进入队列，可在 provider 中追加失效钩子触发缓存刷新。
