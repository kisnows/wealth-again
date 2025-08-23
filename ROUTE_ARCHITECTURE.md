# 路由架构设计文档

## 整体架构原则

- **层级清晰**：按功能模块组织，避免过深嵌套
- **语义明确**：URL路径直接反映页面功能
- **扩展性好**：便于未来添加新功能模块

## 完整路由结构

### 1. 根路径
```
/ - 首页/重定向到仪表板
```

### 2. 身份验证 `/(auth)/`
```
/(auth)/login     - 登录页面 ✅
/(auth)/register  - 注册页面 ✅
```

### 3. 核心业务模块 `/(dashboard)/`

#### 主仪表板
```
/(dashboard)/dashboard - 主仪表板概览 ✅
```

#### 收入管理模块
```
/(dashboard)/income/          - 收入管理主页 ✅
/(dashboard)/income/summary/  - 收入汇总统计 ✅
```

#### 投资管理模块
```
/(dashboard)/investment/              - 投资管理主页 ✅
/(dashboard)/investment/accounts/[id] - 具体账户详情 ✅
```

#### 税务管理模块
```
/(dashboard)/tax/                - 税务管理主页 ❌
/(dashboard)/tax/config/         - 税务基础配置 ✅
/(dashboard)/tax/rates/          - 税率管理 ❌
/(dashboard)/tax/social-insurance/ - 社保公积金规则管理 ❌
```

#### 系统设置模块
```
/(dashboard)/settings/         - 设置主页 ❌
/(dashboard)/settings/city/    - 城市管理 ✅
/(dashboard)/settings/profile/ - 用户档案 ❌
/(dashboard)/settings/currency/ - 货币设置 ❌
```

## 页面功能映射

### 税务管理模块详细功能

1. **税务主页** (`/tax/`)
   - 税务概览仪表板
   - 快速访问各税务功能
   - 当前税负状态展示

2. **税率管理** (`/tax/rates/`)
   - 个人所得税七级累进税率表管理
   - 支持查看和编辑税率档次
   - 历史税率政策版本管理

3. **社保公积金规则** (`/tax/social-insurance/`)
   - 各城市社保缴费基数和比例管理
   - 公积金缴存规则配置
   - 支持版本管理和生效时间设置

### 设置管理模块详细功能

1. **设置主页** (`/settings/`)
   - 全局设置概览
   - 快速访问各设置功能
   - 用户偏好配置

2. **用户档案** (`/settings/profile/`)
   - 个人信息管理
   - 密码修改
   - 账户安全设置

3. **货币设置** (`/settings/currency/`)
   - 默认货币配置
   - 汇率设置和更新
   - 多货币显示偏好

## 导航结构

```
主导航
├── 仪表板 (/dashboard)
├── 收入管理 (/income)
├── 投资管理 (/investment)
├── 税务管理 (/tax)
└── 设置 (/settings)

税务管理子导航
├── 税务概览 (/tax)
├── 基础配置 (/tax/config)
├── 税率管理 (/tax/rates)
└── 社保公积金 (/tax/social-insurance)

设置子导航
├── 设置概览 (/settings)
├── 用户档案 (/settings/profile)
├── 城市管理 (/settings/city)
└── 货币设置 (/settings/currency)
```