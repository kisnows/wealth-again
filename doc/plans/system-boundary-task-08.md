# 系统边界改造任务 08：Reporting & Audit 完善

## 背景

在 5+1 架构中，Reporting 与 Audit 是横切能力，需要基于 Outbox/队列实现事件回放与审计一致性。当前报表逻辑多为实时聚合，Audit 记录分散且缺乏统一接口，尚未与 Outbox 打通。

## 目标

- 基于 Outbox 构建报表消费者，将账本/收入事件同步到物化视图或报表数据表。
- 在 `src/server/services/audit/` 中抽象统一的 `audit.log(action, meta)` 接口，并确保敏感操作（模拟登录、规则变更、手工回算等）均写入审计日志。
- 提供 Monitoring/回放指引（例如如何重放 Outbox、如何排查失败事件）。

## 执行步骤

1. **报表消费者**：在 `src/server/services/reporting/` 下实现 `outbox-consumer.ts`，消费帐本/收入 Outbox 事件，更新报表数据（可以是缓存表或聚合表）。\n2. **审计封装**：整理现有 `logAudit` 调用，提取公共接口并覆盖管理员操作；与 Outbox 集成（必要时对外发事件）。\n3. **数据模型/索引**：根据报表需求新增必要表或索引（例如 `ReportDataset`），并编写迁移与测试。\n4. **监控与回放**：文档化消费者运行方式、重试策略、失败告警，编写示例脚本或 CLI 指南。\n\n## 验收标准\n\n- 报表消费者可在测试中消费 Outbox 事件并写入预期结果，相关 API 读取新数据源。\n- `audit.log` 接口统一，敏感操作在测试中可断言审计记录存在。\n- 文档描述回放/监控流程，确保运维可操作。\n*** End Patch
