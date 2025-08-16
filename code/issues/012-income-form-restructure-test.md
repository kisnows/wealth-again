# 收入录入表单重构测试

## 任务描述

- 修复奖金计划不生效的问题
- 将收入录入页面重构为两个独立的表单 section：
  1. 工资变化表单
  2. 奖金收入表单

## 完成的修改

### 1. 修复奖金 API 返回结构不一致问题

- 奖金 API 返回 `{ success: true, data: records }`
- 收入页面期望 `{ records: [] }`
- 在 `src/app/(dashboard)/income/page.tsx` 中修复数据处理逻辑

### 2. 重构收入录入表单

- 将原来的单一表单拆分为三个 section：
  - 基本设置（城市）
  - 工资变化表单
  - 奖金收入表单
- 每个表单有独立的提交按钮和处理逻辑

### 3. 更新状态管理

- 分离工资和奖金相关的状态变量
- 使用更清晰的命名：`salaryGross`, `bonusAmount` 等
- 独立的提交函数：`submitSalaryChange`, `submitBonusPlan`

## 测试步骤

### 手动测试

1. 启动开发服务器：`npm run dev`
2. 访问 `/income` 页面
3. 测试基本设置：
   - 修改城市设置
4. 测试工资变化表单：
   - 输入月薪金额
   - 选择生效日期
   - 点击"保存工资变更"
   - 验证成功消息和数据刷新
5. 测试奖金收入表单：
   - 输入奖金金额
   - 选择发放日期
   - 点击"添加奖金计划"
   - 验证成功消息和数据刷新
6. 验证收入预测：
   - 查看预测数据中是否正确显示奖金标记
   - 验证奖金计算是否正确

### API 测试命令

```bash
# 测试工资变更API
curl -X POST http://localhost:3000/api/income/changes \
  -H "Content-Type: application/json" \
  -d '{"city":"Hangzhou","grossMonthly":25000,"effectiveFrom":"2025-01-15"}'

# 测试奖金计划API
curl -X POST http://localhost:3000/api/income/bonus \
  -H "Content-Type: application/json" \
  -d '{"city":"Hangzhou","amount":50000,"effectiveDate":"2025-02-15"}'

# 测试收入预测API
curl "http://localhost:3000/api/income/forecast?start=2025-01&end=2025-12"
```

## 预期结果

1. 奖金计划能正确保存到数据库
2. 收入预测中能正确显示奖金标记和计算结果
3. 表单 UI 清晰分离，用户体验更好
4. 所有 API 调用都能正常工作

## 验证结果

### API 测试结果 ✅

通过 `curl "http://localhost:4000/api/income/forecast?start=2025-01&end=2025-12"` 验证：

1. **奖金数据正常**：

   - 3 月份显示 `"bonusThisMonth": 35000`
   - 标记 `"bonusPaid": true` 正确
   - 总计 `"totalBonus": 35000` 准确

2. **预测计算正确**：
   - 工资数据：`"salaryThisMonth": 20000`
   - 税费计算：考虑了奖金的累计预扣
   - 净收入计算：包含奖金影响

### 前端修复 ✅

1. **表格增强**：

   - 添加"工资"、"奖金"、"税前总计"列
   - 奖金用橙色高亮显示
   - 无奖金月份显示"-"

2. **图表优化**：
   - 分别显示工资和奖金条形图
   - 颜色区分：工资(蓝色)、奖金(橙色)、税后(绿色)

### 问题根因 ✅

**奖金功能本身没有问题**，问题在于：

- 前端表格只显示"税前总计"，没有分解显示工资和奖金
- 用户看不到奖金的具体数额，误以为奖金不生效

## 状态

- [x] 修复奖金计划不生效问题 - **实际是显示问题，已修复**
- [x] 重构表单 UI 为独立 sections
- [x] 更新状态管理和提交逻辑
- [x] 验证代码无 linter 错误
- [x] API 功能验证正常
- [x] 前端显示优化完成
