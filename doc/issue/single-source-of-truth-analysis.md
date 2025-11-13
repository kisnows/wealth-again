# Single Source of Truth 分析报告

## 概述

本报告分析项目中违反 Single Source of Truth 原则的代码重复情况，并提供合并建议。

---

## 1. 金额格式化函数重复

### 问题描述

项目中存在 3 个功能相同但实现略有不同的金额格式化函数：

1. **`/src/lib/domain/money.ts` - `formatMoney()`**（标准实现）
   ```typescript
   export function formatMoney(value: number, currency = "CNY", locale: string = DEFAULT_LOCALE): string {
     try {
       return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
     } catch {
       return `${currency} ${value.toFixed(2)}`;
     }
   }
   ```

2. **`/src/app/accounts/page.tsx` - `formatAmount()`**（重复实现）
   ```typescript
   function formatAmount(value: number, currency: string | null | undefined) {
     if (!Number.isFinite(value)) return "-";
     const fmtCurrency = currency ?? "CNY";
     try {
       return new Intl.NumberFormat("zh-CN", {
         style: "currency",
         currency: fmtCurrency,
         maximumFractionDigits: 2,
       }).format(value);
     } catch {
       return new Intl.NumberFormat("zh-CN", {
         minimumFractionDigits: 2,
         maximumFractionDigits: 2,
       }).format(value);
     }
   }
   ```

3. **`/src/components/modules/accounts/account-format.ts` - `formatAmount()`**（第三个实现）
   ```typescript
   export function formatAmount(value: number, currency?: string | null) {
     if (!Number.isFinite(value)) return "-";
     const currencyCode = currency ?? "CNY";
     try {
       return new Intl.NumberFormat("zh-CN", {
         style: "currency",
         currency: currencyCode,
         maximumFractionDigits: 2,
       }).format(value);
     } catch {
       return new Intl.NumberFormat("zh-CN", {
         minimumFractionDigits: 2,
         maximumFractionDigits: 2,
       }).format(value);
     }
   }
   ```

### 使用统计

- `formatMoney` 在 Dashboard 和 Income 模块使用（正确）
- `formatAmount`（account-format.ts）在 AccountCard、AccountTransactionsList、AccountTransactionsTable 使用
- `formatAmount`（accounts/page.tsx）仅在该页面使用（局部重复）

### 合并建议

**目标：统一使用 `/src/lib/domain/money.ts` 中的 `formatMoney()`**

#### 优化方案

1. **增强 `formatMoney` 函数**（添加空值检查）
   ```typescript
   // /src/lib/domain/money.ts
   export function formatMoney(
     value: number | null | undefined,
     currency: string | null | undefined = "CNY",
     locale: string = DEFAULT_LOCALE,
   ): string {
     if (!Number.isFinite(value)) return "-";
     const currencyCode = currency ?? "CNY";
     try {
       return new Intl.NumberFormat(locale, {
         style: "currency",
         currency: currencyCode,
         maximumFractionDigits: 2,
       }).format(value);
     } catch {
       return new Intl.NumberFormat(locale, {
         minimumFractionDigits: 2,
         maximumFractionDigits: 2,
       }).format(value);
     }
   }
   ```

2. **删除重复实现**
   - 删除 `/src/app/accounts/page.tsx` 中的 `formatAmount` 函数（第 37-51 行）
   - 删除 `/src/components/modules/accounts/account-format.ts` 中的 `formatAmount` 函数
   - 保留 `account-format.ts` 中的其他工具函数（`formatPercent`、`formatDatetime` 等）

3. **更新导入**
   - `/src/app/accounts/page.tsx`：改为 `import { formatMoney } from "@/lib/domain/money"`
   - 所有使用 `account-format.ts` 的组件：更新导入路径

#### 影响范围

需要更新的文件（约 15 个）：
- `/src/app/accounts/page.tsx`
- `/src/components/modules/accounts/AccountCard.tsx`
- `/src/components/modules/accounts/AccountTransactionsList.tsx`
- `/src/components/modules/accounts/AccountTransactionsTable.tsx`
- 其他使用 `formatAmount` 的组件

---

## 2. 指标卡片组件重复

### 问题描述

项目中存在两个功能相似但实现独立的指标卡片组件：

1. **`/src/app/dashboard/page.tsx` - `MetricCard`**
   ```typescript
   function MetricCard({
     icon,
     title,
     value,
     hint,
     accent,
     testId,
   }: MetricCardProps) {
     const accentToken = accentTokens[accent];
     return (
       <Card className="...">
         <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", accentToken.gradient)} />
         <CardHeader>
           <div className="text-sm font-medium text-muted-foreground">{title}</div>
           <div className={cn("rounded-md p-2", accentToken.surface)}>{icon}</div>
         </CardHeader>
         <CardContent>
           <div className={cn("text-2xl font-semibold md:text-3xl", accentToken.emphasis)}>
             {value}
           </div>
           {hint ? <div className="mt-2 text-xs text-muted-foreground">{hint}</div> : null}
         </CardContent>
       </Card>
     );
   }
   ```

2. **`/src/components/modules/income/IncomeAnalyticsPanel.tsx` - `SummaryCard`**
   ```typescript
   function SummaryCard({
     icon: Icon,
     label,
     value,
     helper,
     testId,
     accent,
   }: {...}) {
     const accentToken = accentTokens[accent];
     return (
       <div className="space-y-2 rounded-lg border border-border/60 bg-card/80 p-4 shadow-sm">
         <div className="flex items-center gap-2">
           <span className={cn("flex h-8 w-8 items-center justify-center rounded-full", accentToken.surface)}>
             <Icon className="h-4 w-4" />
           </span>
           {label}
         </div>
         <div className={cn("text-xl font-semibold", accentToken.emphasis)}>{value}</div>
         {helper ? <div className="text-xs text-muted-foreground">{helper}</div> : null}
       </div>
     );
   }
   ```

### 差异分析

| 特性 | MetricCard | SummaryCard |
|------|-----------|-------------|
| 容器类型 | `<Card>` 组件 | `<div>` 元素 |
| 顶部装饰 | 渐变色条 | 无 |
| 图标位置 | 右上角 | 标题左侧 |
| 标题字段 | `title` | `label` |
| 提示字段 | `hint` | `helper` |
| 字体大小 | `text-2xl md:text-3xl` | `text-xl` |
| 使用场景 | Dashboard 主要指标 | Income 汇总指标 |

### 合并建议

**目标：创建统一的 `MetricCard` 组件**

#### 优化方案

1. **创建可配置的通用组件**
   ```typescript
   // /src/components/modules/reporting/MetricCard.tsx
   type MetricCardVariant = "default" | "compact";

   interface MetricCardProps {
     icon: LucideIcon;
     title: string;
     value: string | ReactNode;
     hint?: string | ReactNode;
     accent: AccentKey;
     testId: string;
     variant?: MetricCardVariant;
     showTopBorder?: boolean;
   }

   export function MetricCard({
     icon: Icon,
     title,
     value,
     hint,
     accent,
     testId,
     variant = "default",
     showTopBorder = true,
   }: MetricCardProps) {
     const accentToken = accentTokens[accent];
     const isCompact = variant === "compact";

     if (isCompact) {
       return (
         <div
           className="space-y-2 rounded-lg border border-border/60 bg-card/80 p-4 shadow-sm"
           data-testid={testId}
         >
           <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
             <span className={cn("flex h-8 w-8 items-center justify-center rounded-full", accentToken.surface)}>
               <Icon className="h-4 w-4" />
             </span>
             {title}
           </div>
           <div className={cn("text-xl font-semibold", accentToken.emphasis)}>{value}</div>
           {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
         </div>
       );
     }

     return (
       <Card
         className="relative overflow-hidden border border-border/60 bg-card shadow-sm"
         data-testid={testId}
       >
         {showTopBorder && (
           <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", accentToken.gradient)} />
         )}
         <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
           <div className="text-sm font-medium text-muted-foreground">{title}</div>
           <div className={cn("rounded-md p-2", accentToken.surface)}>
             <Icon className="h-5 w-5" />
           </div>
         </CardHeader>
         <CardContent className="pt-0">
           <div className={cn("text-2xl font-semibold md:text-3xl", accentToken.emphasis)}>
             {value}
           </div>
           {hint ? <div className="mt-2 text-xs text-muted-foreground">{hint}</div> : null}
         </CardContent>
       </Card>
     );
   }
   ```

2. **删除重复实现**
   - 删除 `/src/app/dashboard/page.tsx` 中的 `MetricCard` 组件（第 57-95 行）
   - 删除 `/src/components/modules/income/IncomeAnalyticsPanel.tsx` 中的 `SummaryCard` 组件（第 738-779 行）

3. **更新调用**
   - Dashboard 使用默认 variant：`<MetricCard variant="default" showTopBorder={true} ... />`
   - IncomeAnalyticsPanel 使用紧凑 variant：`<MetricCard variant="compact" showTopBorder={false} ... />`

#### 影响范围

需要更新的文件：
- `/src/app/dashboard/page.tsx`（约 4 处调用）
- `/src/components/modules/income/IncomeAnalyticsPanel.tsx`（约 4 处调用）

---

## 3. 总额计算逻辑重复

### 问题描述

资产/负债/净资产的计算逻辑在多个地方重复实现：

1. **`/src/app/dashboard/page.tsx`**
   ```typescript
   const totals = useMemo(() => {
     if (accountsSummaryData?.totals) return accountsSummaryData.totals;
     const items = accountsSummaryData?.items ?? [];
     return items.reduce(
       (acc, item) => {
         const value = displayCurrency && item.displayValue != null
           ? item.displayValue : (item.valuation ?? 0);
         if (item.accountType === "LOAN") acc.liabilities += value;
         else acc.assets += value;
         acc.netWorth = acc.assets - acc.liabilities;
         return acc;
       },
       { assets: 0, liabilities: 0, netWorth: 0 },
     );
   }, [accountsSummaryData, displayCurrency]);
   ```

2. **`/src/app/accounts/page.tsx`**
   ```typescript
   const totals = useMemo(() => {
     if (summaryData?.totals) return summaryData.totals;
     return summaries.reduce(
       (acc, item) => {
         const valuationValue = displayCurrency && typeof item.displayValue === "number"
           ? Number(item.displayValue) : Number(item.valuation ?? 0);
         if ((item.status ?? "ACTIVE") === "ARCHIVED") {
           acc.archived += valuationValue;
         }
         if (item.accountType === "LOAN") acc.liabilities += valuationValue;
         else acc.assets += valuationValue;
         acc.netWorth = acc.assets - acc.liabilities;
         return acc;
       },
       { assets: 0, liabilities: 0, archived: 0, netWorth: 0 },
     );
   }, [summaries, summaryData?.totals, displayCurrency]);
   ```

### 差异分析

- Dashboard 不统计已归档账户
- Accounts 页面统计已归档账户（`archived` 字段）
- 两者的币种转换逻辑略有不同（`item.displayValue` vs `Number(item.displayValue)`）

### 合并建议

**目标：提取通用的总额计算函数**

#### 优化方案

1. **创建领域工具函数**
   ```typescript
   // /src/lib/domain/accounts.ts
   export interface AccountTotals {
     assets: number;
     liabilities: number;
     netWorth: number;
     archived?: number;
   }

   export interface AccountSummaryItem {
     accountType: string;
     valuation: number | null;
     displayValue?: number | null;
     status?: string;
   }

   export function calculateAccountTotals(
     items: AccountSummaryItem[],
     options: {
       includeArchived?: boolean;
       preferDisplayValue?: boolean;
     } = {},
   ): AccountTotals {
     const { includeArchived = false, preferDisplayValue = false } = options;

     return items.reduce(
       (acc, item) => {
         const value = preferDisplayValue && item.displayValue != null
           ? Number(item.displayValue)
           : Number(item.valuation ?? 0);

         const isArchived = (item.status ?? "ACTIVE") === "ARCHIVED";

         if (includeArchived && isArchived) {
           acc.archived = (acc.archived ?? 0) + value;
         }

         if (item.accountType === "LOAN") {
           acc.liabilities += value;
         } else {
           acc.assets += value;
         }

         acc.netWorth = acc.assets - acc.liabilities;
         return acc;
       },
       {
         assets: 0,
         liabilities: 0,
         netWorth: 0,
         ...(includeArchived ? { archived: 0 } : {}),
       } as AccountTotals,
     );
   }
   ```

2. **更新调用代码**
   ```typescript
   // /src/app/dashboard/page.tsx
   import { calculateAccountTotals } from "@/lib/domain/accounts";

   const totals = useMemo(() => {
     if (accountsSummaryData?.totals) return accountsSummaryData.totals;
     const items = accountsSummaryData?.items ?? [];
     return calculateAccountTotals(items, {
       includeArchived: false,
       preferDisplayValue: Boolean(displayCurrency),
     });
   }, [accountsSummaryData, displayCurrency]);
   ```

   ```typescript
   // /src/app/accounts/page.tsx
   import { calculateAccountTotals } from "@/lib/domain/accounts";

   const totals = useMemo(() => {
     if (summaryData?.totals) return summaryData.totals;
     return calculateAccountTotals(summaries, {
       includeArchived: true,
       preferDisplayValue: Boolean(displayCurrency),
     });
   }, [summaries, summaryData?.totals, displayCurrency]);
   ```

#### 影响范围

需要更新的文件：
- `/src/app/dashboard/page.tsx`
- `/src/app/accounts/page.tsx`

---

## 4. 空状态与错误状态组件重复

### 问题描述

项目中有 20+ 处重复的空状态和错误状态 UI 代码：

**空状态示例**（重复 20+ 次）：
```typescript
<Card>
  <CardContent className="flex items-center gap-3 py-10 text-sm text-muted-foreground">
    <AlertCircleIcon className="h-5 w-5 shrink-0" />
    <span>暂无数据。</span>
  </CardContent>
</Card>
```

**错误状态示例**（重复 18+ 次）：
```typescript
<Card>
  <CardContent className="flex items-center gap-3 py-8 text-sm text-destructive">
    <AlertCircleIcon className="h-5 w-5 shrink-0" />
    <span>数据加载失败，请稍后重试。</span>
  </CardContent>
</Card>
```

### 合并建议

**目标：创建可复用的状态展示组件**

#### 优化方案

1. **创建通用状态组件**
   ```typescript
   // /src/components/modules/common/StateCard.tsx
   import { AlertCircleIcon, AlertTriangleIcon, InfoIcon } from "lucide-react";
   import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
   import { cn } from "@/lib/utils";

   type StateCardVariant = "empty" | "error" | "info" | "warning";

   interface StateCardProps {
     variant?: StateCardVariant;
     title?: string;
     description?: string;
     icon?: React.ComponentType<{ className?: string }>;
     testId?: string;
     className?: string;
   }

   const VARIANT_CONFIG = {
     empty: {
       icon: AlertCircleIcon,
       titleColor: "text-muted-foreground",
       descColor: "text-muted-foreground",
       iconColor: "text-muted-foreground",
     },
     error: {
       icon: AlertTriangleIcon,
       titleColor: "text-destructive",
       descColor: "text-destructive",
       iconColor: "text-destructive",
     },
     info: {
       icon: InfoIcon,
       titleColor: "text-foreground",
       descColor: "text-muted-foreground",
       iconColor: "text-primary",
     },
     warning: {
       icon: AlertTriangleIcon,
       titleColor: "text-warning-foreground",
       descColor: "text-warning-foreground/80",
       iconColor: "text-warning",
     },
   };

   export function StateCard({
     variant = "empty",
     title,
     description,
     icon: CustomIcon,
     testId,
     className,
   }: StateCardProps) {
     const config = VARIANT_CONFIG[variant];
     const Icon = CustomIcon ?? config.icon;

     if (title) {
       return (
         <Card className={className} data-testid={testId}>
           <CardHeader>
             <CardTitle className={cn("flex items-center gap-2", config.titleColor)}>
               <Icon className={cn("h-5 w-5 shrink-0", config.iconColor)} />
               {title}
             </CardTitle>
             {description && (
               <CardDescription className={config.descColor}>{description}</CardDescription>
             )}
           </CardHeader>
         </Card>
       );
     }

     return (
       <Card className={className} data-testid={testId}>
         <CardContent className={cn("flex items-center gap-3 py-8 text-sm", config.descColor)}>
           <Icon className={cn("h-5 w-5 shrink-0", config.iconColor)} />
           <span>{description ?? "无数据"}</span>
         </CardContent>
       </Card>
     );
   }
   ```

2. **使用示例**
   ```typescript
   // 空状态
   <StateCard variant="empty" description="当前区间暂无收入记录或预测数据。" />

   // 错误状态
   <StateCard variant="error" description="收入数据加载失败，请稍后重试。" />

   // 带标题的错误状态
   <StateCard
     variant="error"
     title="加载失败"
     description="数据加载失败，请稍后重试"
   />
   ```

3. **批量替换**
   需要更新约 38 处代码（20 处空状态 + 18 处错误状态）

#### 影响范围

涉及的组件：
- `AccountTable.tsx`
- `AccountTransactionsList.tsx`
- `IncomeAnalyticsPanel.tsx`
- `IncomeRecalcPanel.tsx`
- `IncomeEntryModule.tsx`
- `AccountsSummaryTable.tsx`
- `activity/page.tsx`
- `reporting/page.tsx`
- 等约 15 个文件

---

## 5. 加载骨架屏重复

### 问题描述

虽然已优化各页面的 Loading 状态，但骨架屏代码存在大量重复：

**表格骨架屏**（重复 5+ 次）：
```typescript
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>月份</TableHead>
      <TableHead className="text-right">金额</TableHead>
      ...
    </TableRow>
  </TableHeader>
  <TableBody>
    {[1, 2, 3, 4, 5].map((i) => (
      <TableRow key={i}>
        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
        <TableCell className="text-right"><Skeleton className="h-5 w-24" /></TableCell>
        ...
      </TableRow>
    ))}
  </TableBody>
</Table>
```

**卡片骨架屏**（重复 8+ 次）：
```typescript
<Card>
  <CardHeader>
    <CardTitle>
      <Skeleton className="h-5 w-32" />
    </CardTitle>
    <CardDescription>
      <Skeleton className="h-4 w-64" />
    </CardDescription>
  </CardHeader>
  <CardContent>
    <Skeleton className="h-8 w-full" />
  </CardContent>
</Card>
```

### 合并建议

**目标：创建可配置的骨架屏组件库**

#### 优化方案

1. **创建通用骨架屏组件**
   ```typescript
   // /src/components/modules/common/Skeletons.tsx
   import { Skeleton } from "@/components/ui/skeleton";
   import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
   import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

   interface TableSkeletonProps {
     columns: Array<{ header: string; align?: "left" | "right" | "center"; width?: string }>;
     rows?: number;
     testId?: string;
   }

   export function TableSkeleton({ columns, rows = 5, testId }: TableSkeletonProps) {
     return (
       <Table data-testid={testId}>
         <TableHeader>
           <TableRow>
             {columns.map((col, i) => (
               <TableHead key={i} className={col.align === "right" ? "text-right" : ""}>
                 {col.header}
               </TableHead>
             ))}
           </TableRow>
         </TableHeader>
         <TableBody>
           {Array.from({ length: rows }).map((_, rowIndex) => (
             <TableRow key={rowIndex}>
               {columns.map((col, colIndex) => (
                 <TableCell
                   key={colIndex}
                   className={col.align === "right" ? "text-right" : ""}
                 >
                   <Skeleton className={cn("h-5", col.width ?? "w-24")} />
                 </TableCell>
               ))}
             </TableRow>
           ))}
         </TableBody>
       </Table>
     );
   }

   interface CardSkeletonProps {
     title?: boolean;
     description?: boolean;
     contentLines?: number;
     testId?: string;
   }

   export function CardSkeleton({ title = true, description = true, contentLines = 3, testId }: CardSkeletonProps) {
     return (
       <Card data-testid={testId}>
         {(title || description) && (
           <CardHeader>
             {title && (
               <CardTitle>
                 <Skeleton className="h-5 w-32" />
               </CardTitle>
             )}
             {description && (
               <CardDescription>
                 <Skeleton className="h-4 w-64" />
               </CardDescription>
             )}
           </CardHeader>
         )}
         <CardContent className="space-y-2">
           {Array.from({ length: contentLines }).map((_, i) => (
             <Skeleton key={i} className="h-4 w-full" />
           ))}
         </CardContent>
       </Card>
     );
   }

   interface MetricCardSkeletonProps {
     count?: number;
     testId?: string;
   }

   export function MetricCardSkeleton({ count = 4, testId }: MetricCardSkeletonProps) {
     return (
       <>
         {Array.from({ length: count }).map((_, i) => (
           <div
             key={i}
             className="space-y-2 rounded-lg border border-border/60 bg-card/80 p-4 shadow-sm"
             data-testid={`${testId}-${i}`}
           >
             <div className="flex items-center gap-2">
               <Skeleton className="h-8 w-8 rounded-full" />
               <Skeleton className="h-4 w-20" />
             </div>
             <Skeleton className="h-7 w-32" />
             <Skeleton className="h-3 w-40" />
           </div>
         ))}
       </>
     );
   }
   ```

2. **使用示例**
   ```typescript
   // 表格骨架屏
   <TableSkeleton
     columns={[
       { header: "月份", width: "w-20" },
       { header: "金额", align: "right", width: "w-24" },
       { header: "操作", align: "right", width: "w-16" },
     ]}
     rows={5}
     testId="income-table-loading"
   />

   // 卡片骨架屏
   <CardSkeleton title description contentLines={3} testId="dashboard-loading" />

   // 指标卡骨架屏
   <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
     <MetricCardSkeleton count={4} testId="income-summary-loading" />
   </div>
   ```

#### 影响范围

需要更新约 13 处代码：
- `AccountTable.tsx`
- `IncomeAnalyticsPanel.tsx`
- `IncomeRecalcPanel.tsx`
- `IncomeEntryModule.tsx`
- `activity/page.tsx`
- `reporting/page.tsx`
- 等约 10 个文件

---

## 实施优先级

### P0（高优先级 - 建议立即处理）

1. **金额格式化函数重复**
   - 影响范围：15+ 个文件
   - 实施风险：低（纯函数替换）
   - 收益：减少维护成本，统一格式化行为

### P1（中优先级 - 建议短期处理）

2. **指标卡片组件重复**
   - 影响范围：2 个文件，8 处调用
   - 实施风险：中（涉及 UI 结构调整）
   - 收益：统一视觉风格，减少代码量

3. **总额计算逻辑重复**
   - 影响范围：2 个文件
   - 实施风险：低（纯逻辑提取）
   - 收益：统一计算规则，减少错误

### P2（低优先级 - 建议长期优化）

4. **空状态与错误状态组件重复**
   - 影响范围：15+ 个文件，38 处调用
   - 实施风险：低（UI 替换）
   - 收益：统一错误处理 UI，提升用户体验

5. **加载骨架屏重复**
   - 影响范围：10+ 个文件
   - 实施风险：低（UI 替换）
   - 收益：统一加载状态，减少代码量

---

## 实施计划

### 阶段 1：金额格式化统一（1-2 小时）

1. 增强 `/src/lib/domain/money.ts` 中的 `formatMoney` 函数
2. 删除 `/src/app/accounts/page.tsx` 中的 `formatAmount`
3. 重构 `/src/components/modules/accounts/account-format.ts`（删除 `formatAmount`，保留其他工具）
4. 批量更新导入（使用 grep + replace）
5. 运行测试验证

### 阶段 2：指标卡片组件统一（2-3 小时）

1. 创建 `/src/components/modules/reporting/MetricCard.tsx`
2. 删除 Dashboard 和 IncomeAnalyticsPanel 中的本地组件
3. 更新调用代码（Dashboard 使用 `variant="default"`，Income 使用 `variant="compact"`）
4. 验证 UI 一致性（截图对比）

### 阶段 3：总额计算逻辑统一（1 小时）

1. 创建 `/src/lib/domain/accounts.ts` 并实现 `calculateAccountTotals`
2. 更新 Dashboard 和 Accounts 页面调用
3. 编写单元测试覆盖新函数

### 阶段 4：状态组件统一（2-3 小时）

1. 创建 `/src/components/modules/common/StateCard.tsx`
2. 批量替换空状态和错误状态代码（使用 regex）
3. 验证各页面的错误/空状态展示

### 阶段 5：骨架屏组件统一（2-3 小时）

1. 创建 `/src/components/modules/common/Skeletons.tsx`
2. 逐页面替换现有骨架屏代码
3. 验证加载状态的视觉一致性

---

## 长期建议

### 1. 建立组件库索引

在 `/doc/frontend-spec.md` 中维护可复用组件清单：
```markdown
## 可复用组件库

### 数据展示
- `MetricCard` - 指标卡片（支持 default/compact variant）
- `StateCard` - 空状态/错误状态展示

### 加载状态
- `TableSkeleton` - 表格骨架屏
- `CardSkeleton` - 卡片骨架屏
- `MetricCardSkeleton` - 指标卡骨架屏

### 工具函数
- `formatMoney` - 金额格式化（`@/lib/domain/money`）
- `calculateAccountTotals` - 账户总额计算（`@/lib/domain/accounts`）
```

### 2. 代码审查清单

在提交 PR 前检查：
- [ ] 是否使用了现有的格式化函数？
- [ ] 是否可以复用现有的 UI 组件？
- [ ] 是否提取了重复的计算逻辑？
- [ ] 是否使用了统一的加载/空状态组件？

### 3. Lint 规则补充

考虑添加自定义 ESLint 规则：
```typescript
// .eslintrc.js
rules: {
  "no-restricted-syntax": [
    "error",
    {
      selector: "CallExpression[callee.object.name='Intl'][callee.property.name='NumberFormat']",
      message: "请使用 @/lib/domain/money 中的 formatMoney 函数",
    },
  ],
}
```

---

## 总结

当前项目中存在以下主要的 Single Source of Truth 违反情况：

1. **金额格式化函数**：3 个重复实现，影响 15+ 个文件
2. **指标卡片组件**：2 个相似实现，影响 2 个文件
3. **总额计算逻辑**：2 个重复实现，影响 2 个文件
4. **空状态/错误状态**：38 处重复代码，影响 15+ 个文件
5. **加载骨架屏**：13+ 处重复代码，影响 10+ 个文件

建议按照优先级逐步实施合并，预计总工时 10-12 小时，可显著提升代码可维护性和一致性。
