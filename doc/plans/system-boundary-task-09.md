# 系统边界改造任务 09：FX Provider 封装与缓存策略

## 背景

系统边界规划的阶段 2 要求将 FX 逻辑集中封装，提供统一的报价/时间序列接口，并处理缓存、降级与快照落库。当前 `src/server/services/fx.ts` 仍由旧代码直接暴露多个方法，调用方散落，缺乏可配置缓存与降级策略。

## 目标

- 在 `src/server/services/fx/provider.ts` 中实现统一入口（`getQuote`、`getLatestRates`、`getTimeSeries` 等），内部处理缓存/回退逻辑。
- 更新所有调用方（Ledger/Valuations/Income/Reporting 等）改为依赖 provider，而非直接访问 Prisma。
- 将 FX 快照写入、缓存失效策略、降级方案文档化，便于 Outbox/队列后续集成。

## 执行步骤

1. 新建 `fx/provider.ts`、重构 `fx.ts` 为 provider 适配层；抽象缓存接口，提供内存缓存与可扩展外部缓存钩子。
2. 更新账本、估值、收入、报表等服务调用，统一通过 provider 请求汇率；在测试中补充 provider mock。
3. 同步前端汇率依赖（如仪表盘、资产估值、收入图表），改为调用新的 API/缓存策略，必要时更新 SWR key 与错误处理。
4. 增加 `fx.provider.test.ts` 或扩展现有测试，覆盖缓存命中、回退（`allowMissing`）与快照写入场景。
5. 文档化缓存策略（TTL、回退到实时查询）和配置项（环境变量、可插拔缓存）。

## 验收标准

- 所有业务代码通过 provider 访问 FX，不再直接访问 Prisma `fxRate` / `fxSnapshot`。
- 测试覆盖缓存命中、回退、异常降级；`pnpm test` 通过。
- 文档说明缓存 TTL、回退策略及可选配置。
