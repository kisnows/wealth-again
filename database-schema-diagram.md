# 数据库表关联关系图

## 整体架构概述

这是一个个人财富管理系统的数据库设计，主要包含以下几个核心模块：

1. **用户管理模块** - User
2. **投资管理模块** - Account, Instrument, Transaction, Lot, ValuationSnapshot
3. **市场数据模块** - Price, FxRate
4. **收入管理模块** - IncomeRecord, IncomeChange, BonusPlan
5. **系统配置模块** - Config

## 表关联关系图

```mermaid
erDiagram
    %% 用户中心
    User {
        string id PK "用户唯一标识"
        string email UK "登录邮箱"
        string password "加密密码"
        string name "用户姓名"
        datetime createdAt "创建时间"
    }

    %% 投资账户相关
    Account {
        string id PK "账户ID"
        string userId FK "所属用户"
        string name "账户名称"
        string baseCurrency "基础货币"
        datetime createdAt "创建时间"
    }

    Instrument {
        string id PK "工具ID"
        string symbol "交易代码"
        string market "交易市场"
        string currency "计价货币"
        string type "工具类型"
        datetime createdAt "创建时间"
    }

    Transaction {
        string id PK "交易ID"
        string accountId FK "所属账户"
        string type "交易类型"
        datetime tradeDate "交易日期"
        string instrumentId FK "金融工具"
        decimal quantity "交易数量"
        decimal price "交易价格"
        decimal cashAmount "现金变动"
        string currency "交易货币"
        decimal fee "手续费"
        decimal tax "税费"
        string lotId FK "持仓批次"
        string note "备注"
        datetime createdAt "创建时间"
    }

    Lot {
        string id PK "批次ID"
        string accountId FK "所属账户"
        string instrumentId FK "金融工具"
        decimal qty "持仓数量"
        decimal costPerUnit "单位成本"
        datetime openDate "建仓日期"
        string method "成本方法"
    }

    ValuationSnapshot {
        string id PK "快照ID"
        string accountId FK "所属账户"
        datetime asOf "快照时间"
        decimal totalValue "总价值"
        string breakdown "价值分解"
        datetime createdAt "创建时间"
    }

    %% 市场数据
    Price {
        string id PK "价格ID"
        string instrumentId FK "金融工具"
        datetime asOf "价格日期"
        decimal close "收盘价"
        string currency "价格货币"
    }

    FxRate {
        string id PK "汇率ID"
        string base "基础货币"
        string quote "计价货币"
        datetime asOf "汇率日期"
        decimal rate "汇率值"
    }

    %% 收入管理
    IncomeRecord {
        string id PK "收入ID"
        string userId FK "所属用户"
        string city "工作城市"
        int year "年份"
        int month "月份"
        decimal gross "税前收入"
        decimal bonus "当月奖金"
        string overrides "覆盖参数"
        datetime createdAt "创建时间"
    }

    IncomeChange {
        string id PK "变更ID"
        string userId FK "所属用户"
        string city "工作城市"
        decimal grossMonthly "月度收入"
        datetime effectiveFrom "生效日期"
        datetime createdAt "创建时间"
    }

    BonusPlan {
        string id PK "奖金ID"
        string userId FK "所属用户"
        string city "工作城市"
        decimal amount "奖金金额"
        datetime effectiveDate "发放日期"
        datetime createdAt "创建时间"
    }

    %% 系统配置
    Config {
        string id PK "配置ID"
        string key "配置键"
        string value "配置值"
        datetime effectiveFrom "生效开始"
        datetime effectiveTo "生效结束"
        datetime createdAt "创建时间"
    }

    %% 关系定义
    User ||--o{ Account : "拥有"
    User ||--o{ IncomeRecord : "记录"
    User ||--o{ IncomeChange : "变更"
    User ||--o{ BonusPlan : "计划"

    Account ||--o{ Transaction : "包含"
    Account ||--o{ Lot : "持有"
    Account ||--o{ ValuationSnapshot : "快照"

    Instrument ||--o{ Transaction : "交易"
    Instrument ||--o{ Lot : "持仓"
    Instrument ||--o{ Price : "价格"

    Lot ||--o{ Transaction : "关联"
```

## 核心业务流程

### 1. 投资交易流程

```
用户 → 账户 → 交易记录 → 持仓批次
                ↓
         金融工具 ← 价格数据
```

### 2. 估值计算流程

```
持仓批次 + 最新价格 + 汇率 → 账户估值快照
```

### 3. 收入管理流程

```
用户 → 收入变更 → 月度收入记录 → 奖金计划
```

## 关键设计特点

### 数据完整性约束

- **唯一性约束**：
  - 用户邮箱全局唯一
  - 同一用户下账户名称唯一
  - 同一账户在同一时间点的估值快照唯一
  - 同一金融工具在同一日期的价格唯一
  - 同一货币对在同一日期的汇率唯一
  - 同一用户在同一年月的收入记录唯一

### 索引优化

- **性能索引**：
  - 金融工具按交易代码索引
  - 交易记录按账户和日期索引
  - 系统配置按键名索引
  - 收入变更按用户和生效日期索引
  - 奖金计划按用户和发放日期索引

### 灵活性设计

- **多货币支持**：账户、工具、交易都支持不同货币
- **扩展性配置**：Config 表支持 JSON 格式存储复杂配置
- **成本计算方法**：Lot 表支持 FIFO、LIFO 等多种成本计算方法
- **税务参数覆盖**：收入记录支持特殊税率参数

### 审计追踪

- 所有核心表都包含创建时间字段
- 交易记录保留完整的交易轨迹
- 收入变更记录薪资历史
- 估值快照记录账户价值变化

## 使用场景示例

1. **投资组合管理**：用户可以创建多个投资账户，记录买卖交易，系统自动计算持仓成本和收益
2. **业绩分析**：通过估值快照追踪账户价值变化，结合价格数据计算投资回报
3. **税务计算**：记录月度收入，结合城市税率参数计算个人所得税
4. **多货币支持**：支持港股、美股等外币投资，通过汇率表进行货币转换
5. **奖金规划**：记录奖金发放计划，用于收入预测和税务规划
