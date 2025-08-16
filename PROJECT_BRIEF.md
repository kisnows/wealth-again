# Wealth-Again 项目简报

## 项目概述

Wealth-Again 是一个使用 Next.js、TypeScript 和 Prisma 构建的个人财富管理系统。该系统帮助用户跟踪收入、投资，并根据中国税法计算税务影响。它旨在为个人用户提供全面的财务管理解决方案，包括收入管理、投资组合跟踪和税务优化建议。

## 核心功能

### 1. 收入管理
- 跟踪月薪、季度/年度奖金
- 根据中国税收制度计算税收扣除（社保、公积金、个人所得税）
- 预测年度收入和税收情况
- 管理收入变更历史和奖金计划

### 2. 投资管理
- 跟踪多个投资账户（如券商账户、基金账户等）
- 记录交易（存款、取款、买卖交易）
- 计算绩效指标（TWR、XIRR）
- 跟踪投资组合估值变化
- 支持账户间转账和多货币处理

### 3. 税务参数配置
- 配置城市、年份、税率区间等税务参数
- 可视化展示税务参数（税率表、社保比例等）
- 以JSON格式保存和加载配置
- 支持不同城市的税务政策配置

## 技术架构

### 前端技术栈
- **框架**: Next.js 14 与 React 18
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **UI组件**: shadcn/ui
- **数据可视化**: recharts
- **状态管理**: React 内置状态管理

### 后端技术栈
- **API**: Next.js API 路由
- **认证**: NextAuth.js
- **数据库**: SQLite 与 Prisma ORM
- **数据验证**: Zod

### 开发工具
- **测试**: Vitest
- **类型检查**: TypeScript
- **代码检查**: ESLint
- **构建工具**: Next.js 内置构建系统

## 数据模型

系统使用 Prisma ORM 管理以下核心数据模型：

1. **User**: 系统用户
2. **Account**: 投资账户
3. **Instrument**: 金融工具（股票、基金等）
4. **Transaction**: 所有金融交易
5. **IncomeRecord**: 薪资和奖金记录
6. **ValuationSnapshot**: 用于绩效计算的账户价值快照
7. **TaxBracket**: 个人所得税税率档次
8. **SocialInsuranceConfig**: 社保公积金配置
9. **FxRate**: 汇率数据

## 核心业务逻辑

### 税务计算
- 实现了符合中国税法的个人所得税计算逻辑
- 支持累计预扣法计算个税
- 自动计算社保和公积金扣除
- 支持专项附加扣除和其他法定扣除

### 投资绩效分析
- 实现了时间加权收益率(TWR)计算
- 实现了内部收益率(XIRR)计算
- 支持多账户、多货币的投资组合绩效分析

## API 接口

系统提供以下核心 API 接口：

### 收入管理接口
- `/api/income/forecast` - 收入和税收预测
- `/api/income/monthly` - 月度收入记录
- `/api/income/bonus` - 奖金计划管理
- `/api/income/summary` - 收入汇总信息

### 投资管理接口
- `/api/accounts` - 账户管理
- `/api/accounts/[id]/performance` - 账户绩效分析
- `/api/transactions` - 交易记录管理
- `/api/valuations/snapshot` - 估值快照管理

### 税务配置接口
- `/api/config/tax-params` - 税务参数配置
- `/api/config/tax-params/refresh` - 刷新税务参数

## 开发和部署

### 常用开发命令
```bash
# 安装依赖
npm install

# 运行开发服务器
npm run dev

# 构建生产版本
npm run build

# 运行测试
npm run test

# 运行代码检查
npm run lint

# 生成 Prisma 客户端
npm run prisma:generate

# 运行数据库迁移
npm run prisma:migrate
```

### 部署要求
- Node.js 运行环境
- SQLite 数据库（可替换为其他 Prisma 支持的数据库）
- 环境变量配置（数据库连接、认证密钥等）

## 项目结构

```
src/
├── app/                 # Next.js app router 页面和 API 路由
├── components/          # React UI 组件
│   ├── income/          # 收入管理相关组件
│   ├── investment/      # 投资管理相关组件
│   ├── tax/             # 税务相关组件
│   ├── ui/              # 通用UI组件
│   └── layout/          # 布局组件
├── lib/                 # 核心业务逻辑
│   ├── tax/             # 税务计算模块
│   ├── performance.ts   # 投资绩效计算
│   └── prisma.ts        # Prisma 客户端初始化
├── tests/               # 单元测试
└── prisma/              # Prisma 模式和迁移
```

## 当前状态和未来发展方向

### 当前状态
- 系统已完成核心功能开发
- 具备完整的收入管理和投资管理功能
- 实现了符合中国税法的税务计算
- 提供了基本的UI界面和API接口

### 未来发展方向
1. 增强数据可视化功能
2. 添加更多财务分析工具
3. 支持更多城市的税务政策配置
4. 完善移动端适配
5. 增加数据导入/导出功能
6. 实现更复杂的税务优化建议