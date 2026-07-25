# 文档总览 (Single Source of Truth)

> 本索引是定位所有产品、技术与设计文档的唯一入口。所有文档都经过了合并与精简，以确保信息不冗余，职责清晰。
> 
> **更新日期**: 2025-12-04

## 1. 核心产品与技术规格

| 文档 | 描述 |
|------|------|
| [`prd.md`](./prd.md) | 平台**总体产品需求**，包含产品定位、角色权限、核心功能模块的顶层设计 |
| [`tech.md`](./tech.md) | **总体技术设计**，包含系统架构、服务端领域服务、测试策略、部署运维，以及数据种子与业务规则参考 |

## 2. 模块级详细规格

| 文档 | 描述 |
|------|------|
| [`income-spec.md`](./income-spec.md) | **收入模块**的详细产品需求与技术规格，包含核心概念、计算规则、场景流程与验收标准 |
| [`account-all.md`](./account-all.md) | **账户与汇率系统**的详细产品需求与技术规格 |
| [`frontend-spec.md`](./frontend-spec.md) | **前端开发**的唯一事实来源，整合了技术约束、架构设计、路由规划与页面模块说明 |

## 3. 参考资料

| 文档 | 描述 |
|------|------|
| [`openapi.json`](./openapi.json) | API 接口定义（OpenAPI 格式） |

## 4. 文档维护指引

- **单一来源**: 任何模块的细节都应在其对应的规格文档中维护。
- **保持同步**: 当修改某个模块时，请务必更新其对应的规格文档。
- **交叉引用**: 如果模块间存在依赖，请在文档中通过链接（`./another-doc.md`）进行引用，而不是复制内容。
- **历史清理**: 已完成的改造计划、issue 分析等文档应及时删除，避免信息过期误导。

## 5. 项目关键信息

- **技术栈**: Next.js 15 App Router、TypeScript、better-auth、Prisma、Tailwind CSS、shadcn/ui、SWR、Zustand、Vitest
- **数据库**: SQLite（开发）→ Postgres（生产）
- **核心子系统**: 
  - Accounts & Ledger（账户与账本）
  - Income & Tax（收入与税务）
  - FX & Market Data（汇率与市场数据）
  - Reporting & Analytics（报表与分析）
  - Identity & Audit（身份与审计）
  - Jobs & Event Bus（任务与事件）
