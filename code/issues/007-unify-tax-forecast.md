## 007: 统一税务配置来源并重构收入预测

**目标**: 预测与汇总统一使用 `TaxBracket`/`SocialInsuranceConfig` 表及 `TaxService`，去除对 `Config` JSON 的强依赖，确保按生效日期逐月取配置。

**成功标准**:

- `/api/income/forecast` 基于 `TaxService` 的仓库层逐月查询配置（按月末），不再直接解析 `Config.value`。
- 税改跨月生效时，预测结果发生切换并正确标注 `taxChange`。
- 新增/更新税务配置后，预测接口无需重启即可反映变化。

**子任务**:

1. 服务层
   - 在 `src/lib/tax/service.ts` 增加按月份获取有效配置的公共方法（若已存在则复用）。
   - 在仓库层 `src/lib/tax/repository.ts` 暴露按日期读取 bracket 与 SIHF 的方法（已具备，补充单测）。
2. API 重构
   - 重写 `src/app/api/income/forecast/route.ts`：
     - 用 `TaxService`/`TaxConfigRepository` 替换 `prisma.config` + `normalizeTaxParamsValue` 的旧逻辑。
     - 逐月拉取配置并在配置变化处打标 `taxChange`。
3. 兼容与清理
   - `src/app/api/config/tax-params/route.ts` 保持双写策略，但预测只读新表。
   - 标注 TODO 清除旧 `Config` 读取路径（等前后端完全切换后移除）。
4. 测试
   - 新增 `src/tests/forecast.test.ts`：
     - 场景 1：全年单一配置，预测 12 个月不出现 `taxChange`。
     - 场景 2：年中税改（如 7 月生效），6/7 月的结果发生跳变且 7 月含 `taxChange`。
     - 场景 3：缺少某月配置时报错或返回合理错误码（API 层）。

**测试命令**:

```bash
# 推荐
pnpm test -- src/tests/forecast.test.ts

# 或者（兼容 workspace 配置）
npx -y vitest run src/tests/forecast.test.ts
```

**状态**: Completed
