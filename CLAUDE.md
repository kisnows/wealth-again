# CLAUDE.md

本文档为 Claude Code (claude.ai/code) 在此代码库中工作时提供指导。

## 项目概述

这是一个使用 Next.js、TypeScript 和 Prisma 构建的个人财富管理系统。帮助用户跟踪收入、投资，并根据中国税法计算税务影响。支持多城市税收政策、投资绩效分析和收入预测功能。

## 核心功能

1. **收入管理系统**：

   - 记录月度薪资、季度/年度奖金
   - 根据中国税制计算社保、公积金、个人所得税扣除
   - 收入预测功能，支持历史数据和未来政策变动
   - 收入变更历史跟踪，支持生效日期管理
   - 奖金计划管理，支持提前录入未来奖金

2. **投资管理系统**：

   - 多账户管理（券商、基金等不同类型投资账户）
   - 交易记录（存款、取款、交易流水）
   - 估值快照管理，定期记录账户总价值
   - 投资绩效计算（TWR 时间加权收益率、XIRR 内部收益率）
   - 账户绩效分析和历史追踪

3. **税务配置系统**：
   - 多城市税收参数配置（北京、上海、深圳等）
   - 税率档次管理，支持历史政策和未来政策
   - 社保公积金参数配置，按城市和时间管理
   - 税务政策生效日期管理
   - 配置参数的 JSON 格式存储和加载

## 技术架构

- **前端框架**：Next.js 15 + React 19 (App Router)
- **后端 API**：Next.js API 路由 + 中间件
- **数据库**：SQLite + Prisma ORM
- **身份验证**：NextAuth.js + Prisma 适配器
- **样式系统**：Tailwind CSS v4
- **UI 组件库**：shadcn/ui + Radix UI
- **数据验证**：Zod 架构验证
- **测试框架**：Vitest (Node 环境)
- **金融计算**：自研 TWR、XIRR 算法

## 开发命令

```bash
# 安装项目依赖
npm install

# 启动开发服务器（端口4000）
npm run dev

# 构建生产版本（包含Prisma生成）
npm run build

# 启动生产服务器
npm start

# 运行所有测试
npm run test

# 监听模式运行测试
npm run test:watch

# 运行测试UI界面
npm run test:ui

# 代码检查
npm run lint

# 自动修复代码格式问题
npm run lint:fix

# TypeScript类型检查
npm run type-check

# 生成Prisma客户端
npm run prisma:generate

# 运行数据库迁移
npm run prisma:migrate

# 打开Prisma Studio数据库管理界面
npm run prisma:studio

# 运行端到端测试
npm run playwright

# 账户去重脚本
npm run prisma:dedup-accounts
```

## 项目结构与核心文件

### 应用层架构

- `src/app/` - Next.js App Router 页面和 API 路由
  - `(dashboard)/` - 受保护的仪表板页面，共享布局
    - `dashboard/` - 主仪表板页面
    - `income/` - 收入管理页面
    - `investment/` - 投资管理页面
    - `tax/config/` - 税务配置页面
  - `(auth)/` - 身份验证页面 (login/register)
  - `api/` - 按功能组织的 RESTful API 端点
- `src/components/` - React UI 组件
  - `ui/` - 可复用的 shadcn/ui 组件 (Button, Card, Table 等)
  - 按业务域组织的功能组件

### 核心业务逻辑

- `src/lib/tax/` - 中国税收计算系统
  - `calculator.ts` - 税收计算引擎
  - `service.ts` - 税务服务层
  - `repository.ts` - 税务数据访问层
  - `types.ts` - 税务相关 TypeScript 类型定义
- `src/lib/performance.ts` - 投资绩效计算 (TWR, XIRR)
- `src/lib/currency.ts` - 多货币支持
- `src/lib/validations.ts` - Zod 验证架构定义
- `src/lib/sources/` - 数据源处理
  - `hz-params.ts` - 杭州税务参数
  - `parsers.ts` - 数据解析器

### 基础设施层

- `prisma/schema.prisma` - 包含完整金融模型的数据库架构
- `src/lib/prisma.ts` - Prisma 客户端配置
- `src/lib/auth.ts` - NextAuth.js 身份验证配置
- `src/lib/api-middleware.ts` - API 中间件
- `src/tests/` - 覆盖所有核心功能的综合测试套件

## 数据库模型详解

基于 Prisma 架构定义的核心实体：

### 用户与认证

- **User** - 系统用户，包含邮箱、密码、激活状态等
- **AuditLog** - 完整的系统操作审计日志

### 投资管理

- **Account** - 投资账户（券商、基金账户等），支持多货币
- **Transaction** - 金融交易记录（存款 DEPOSIT、取款 WITHDRAW）
- **ValuationSnapshot** - 账户估值快照，用于绩效计算

### 收入管理

- **IncomeRecord** - 月度收入记录，包含税前收入、奖金、社保等完整信息
- **IncomeChange** - 收入变更历史，支持生效日期
- **BonusPlan** - 奖金发放计划，支持未来奖金预录入

### 税务配置

- **TaxBracket** - 个人所得税税率档次，按城市和时间段管理
- **SocialInsuranceConfig** - 社保公积金配置，按城市管理
- **Config** - 系统级配置参数，支持时间范围有效性

### 汇率与配置

- **FxRate** - 货币汇率信息，支持多货币对
- **Config** - 系统配置，JSON 格式存储复杂配置

## 核心库与计算逻辑

### 税务计算系统 (`src/lib/tax/`)

- 处理中国个人所得税计算，支持累进税率
- 支持多城市不同税收档次和社保政策
- 包含社保、公积金、专项附加扣除等完整计算
- 支持历史税收政策和未来政策的时间管理
- 完善的数据验证和错误处理机制

### 投资绩效分析 (`src/lib/performance.ts`)

- **TWR (时间加权收益率)**：消除资金流入流出影响
- **XIRR (扩展内部收益率)**：使用牛顿-拉夫逊方法计算
- 处理复杂投资场景和多次资金流动
- 支持多币种投资组合绩效计算

### API 架构设计

按业务域组织的 RESTful 端点：

- `/api/income/` - 收入管理和预测功能
  - `calculate/` - 收入税务计算
  - `forecast/` - 收入预测
  - `summary/` - 收入汇总
  - `changes/` - 收入变更管理
  - `bonus/` - 奖金管理
- `/api/accounts/` - 投资账户操作
- `/api/transactions/` - 金融交易管理
- `/api/config/tax-params/` - 税务配置管理
- `/api/auth/` - 身份验证端点

## 测试策略

- **单元测试**：所有核心业务逻辑（税收、绩效、验证）
- **集成测试**：包含数据库操作的 API 端点测试
- **测试环境**：Node.js + Vitest，全面覆盖测试
- **测试数据**：真实的金融场景和边界情况测试

## 关键配置文件

- `next.config.js` - Next.js 配置，包含安全头和优化设置
- `vitest.config.ts` - 测试配置，支持 TypeScript 路径映射
- `tailwind.config.js` - Tailwind CSS v4 配置
- `prisma/schema.prisma` - 数据库架构定义

## 关键约束

- 项目使用 pnpm
- 项目组件库使用 shadcn，所有的组件都会放到 `src/components/ui` 目录下，这个目录下也只允许放置 shadcn 的组件
- 项目样式使用 tailwindcss（v4）
- 项目的前端组件需要添加 data-testid 属性，属性值为组件名的小写，确保全局唯一，遵循 BEM 命名规范
- 所有的临时测试代码必须放到 temp 目录下
