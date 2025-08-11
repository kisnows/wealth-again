# CLAUDE.md

本文档为 Claude Code (claude.ai/code) 在此代码库中工作时提供指导。

## 项目概述

这是一个使用 Next.js、TypeScript 和 Prisma 构建的个人财富管理系统。它帮助用户跟踪收入、投资，并根据中国税法计算税务影响。

## 主要功能

1. **收入管理**：
   - 跟踪月薪、季度/年度奖金
   - 根据中国税收制度计算税收扣除（社保、公积金、个人所得税）
   - 预测年度收入

2. **投资管理**：
   - 跟踪多个投资账户
   - 记录交易（存款、取款、交易）
   - 计算绩效指标（TWR、XIRR）
   - 跟踪投资组合估值变化

3. **税务参数配置**：
   - 配置城市、年份、税率区间等税务参数
   - 可视化展示税务参数（税率表、社保比例等）
   - 以JSON格式保存和加载配置

## 架构

- **前端**：Next.js 14 与 React 18
- **后端**：Next.js API 路由
- **数据库**：SQLite 与 Prisma ORM
- **认证**：NextAuth.js
- **样式**：Tailwind CSS
- **UI 组件**：shadcn/ui
- **验证**：Zod
- **测试**：Vitest

## 常用开发命令

```bash
# 安装依赖
npm install

# 运行开发服务器
npm run dev

# 构建生产版本
npm run build

# 运行测试
npm run test

# 以监听模式运行测试
npm run test:watch

# 运行代码检查
npm run lint

# 生成 Prisma 客户端
npm run prisma:generate

# 运行数据库迁移
npm run prisma:migrate
```

## 项目结构

- `src/app/` - Next.js app router 页面和 API 路由
- `src/lib/` - 核心业务逻辑（税收计算、绩效指标）
- `src/tests/` - 单元测试
- `prisma/` - Prisma 模式和迁移
- `src/components/` - React UI 组件
  - `src/components/ui/` - 通用UI组件（Button, Card, Table等）
  - `src/components/layout/` - 布局组件（导航栏等）
  - `src/components/income/` - 收入管理相关组件
  - `src/components/investment/` - 投资管理相关组件

## 数据模型

Prisma 模式定义了以下关键模型：
- User: 系统用户
- Account: 投资账户
- Transaction: 所有金融交易
- IncomeRecord: 薪资和奖金记录
- ValuationSnapshot: 用于绩效计算的账户价值快照
- Config: 税收参数和系统配置

## 核心库

- `src/lib/tax.ts` - 中国个人所得税计算
- `src/lib/performance.ts` - 投资绩效指标（TWR、XIRR）
- `src/lib/prisma.ts` - Prisma 客户端初始化