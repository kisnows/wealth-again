# 修复收入相关 API 的用户认证问题

## 问题描述

用户反馈在前台看不到奖金数据，经过分析发现根本问题是：**收入相关的 API 使用了错误的用户获取方式**，导致不同用户看到的都是同一个用户的数据。

## 问题根因

### 不一致的用户获取方式

1. **奖金 API** (`/api/income/bonus`) ✅ 正确使用 `getCurrentUser(req)` 获取当前登录用户
2. **预测 API** (`/api/income/forecast`) ❌ 错误使用 `prisma.user.findFirst()` 获取第一个用户
3. **收入变更 API** (`/api/income/changes`) ❌ 错误使用 `prisma.user.findFirst()` 获取第一个用户
4. **收入汇总 API** (`/api/income/summary`) ❌ 错误使用 `prisma.user.findFirst()` 获取第一个用户

### 具体问题

```javascript
// ❌ 错误做法 - 总是获取数据库中的第一个用户
const user = await prisma.user.findFirst();
const bonuses = await prisma.bonusPlan.findMany({
  where: { userId: user.id, city, ... }
});

// ✅ 正确做法 - 获取当前登录用户
const userId = await getCurrentUser(req);
const bonuses = await prisma.bonusPlan.findMany({
  where: { userId, city, ... }
});
```

这导致：

- 用户 A 登录后看到的是用户 B 的奖金数据
- 预测 API 返回的不是当前用户的预测结果
- 多用户系统完全失效

## 修复方案

### 1. 统一用户认证方式 ✅

所有收入相关 API 都使用 `getCurrentUser(req)` 获取当前登录用户：

**修复的 API:**

- `src/app/api/income/forecast/route.ts`
- `src/app/api/income/changes/route.ts`
- `src/app/api/income/summary/route.ts`

**修复内容:**

```javascript
// 添加导入
import { getCurrentUser } from "@/lib/session";

// 修改函数签名，添加try-catch
export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUser(req);
    // ... 使用userId而不是user.id
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    // ... 其他错误处理
  }
}
```

### 2. 统一错误处理 ✅

为所有 API 添加了一致的错误处理：

- 未登录返回 401 状态码
- 统一错误消息格式
- 完整的 try-catch 包装

### 3. 移除不安全的用户创建逻辑 ✅

移除了 `ensureUser()` 函数中自动创建 demo 用户的逻辑，避免安全隐患。

## 测试验证

### 测试脚本

创建了 `test-bonus-fix.js` 脚本来验证修复效果：

```bash
node test-bonus-fix.js
```

### 预期结果

修复后，使用测试账号登录应该能看到：

- 8 月、9 月、10 月的奖金数据正确显示
- 预测表格中奖金列正确填充
- 总计数据包含奖金金额
- 不同用户看到各自的数据

### 测试账号

- 用户名: yq12315@gmail.com
- 密码: 9gKNN@UgGHSssI\*X

## 影响范围

### 修复的功能

1. ✅ 收入预测显示正确的用户数据
2. ✅ 奖金计划按用户隔离
3. ✅ 工资变更记录按用户隔离
4. ✅ 收入汇总报表按用户隔离

### 不受影响的功能

- 投资账户管理（已经正确使用了用户认证）
- 税务参数配置（全局配置）
- 其他已正确实现用户认证的 API

## 重要提醒

**这是一个关键的安全修复！**

在多用户系统中，绝对不能使用 `prisma.user.findFirst()` 来获取用户数据，必须使用当前登录用户的 ID。这个问题如果在生产环境中出现，会导致严重的数据泄露。

## 后续建议

1. **代码审查**: 检查所有 API 确保都使用了正确的用户认证
2. **测试覆盖**: 为多用户场景添加自动化测试
3. **安全扫描**: 定期检查类似的安全问题
4. **文档更新**: 在开发规范中明确用户认证的最佳实践
