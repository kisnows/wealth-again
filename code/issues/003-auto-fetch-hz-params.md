# 自动获取杭州税务/社保参数并自动落库

## 背景

- 需要从权威来源自动获取杭州的综合所得税率表、社保与公积金基数/比例。
- 短期先提供可用的本地兜底参数；后续补充官方来源解析以实现自动更新。

## 子任务清单

1. 新增 `src/lib/sources/hz-params.ts`，提供 `fetchHangzhouParams({year, city})`，默认返回兜底参数并通过 zod 校验。
2. 扩展 `GET /api/config/tax-params`：当 city=Hangzhou 且未命中时，自动调用 `fetchHangzhouParams` 生成并写入配置后返回。
3. 添加最小化验证：`curl "http://localhost:3000/api/config/tax-params?city=Hangzhou&year=2025"` 首次返回 200 并完成自助落库。
4. 单元测试：暂以集成调用替代，后续补充来源解析的单测与 e2e。

## 测试命令

- 首次自动落库：
  - `curl -sS -i "http://localhost:3000/api/config/tax-params?city=Hangzhou&year=2025"`
- 二次读取：
  - `curl -sS -i "http://localhost:3000/api/config/tax-params?city=Hangzhou&year=2025"`

## 后续工作（新任务）

- 增加官方来源解析：
  - 杭州市人社局/医保局/公积金中心每年基数与比例公告页抓取（稳定 URL 模式待调研）。
  - 国家税务总局综合所得税率表为全国统一，可静态内置，变更概率低。
- 增加每日/每周定时刷新与变更生效区间（`effectiveFrom/To`）。
- 新增 e2e 验证覆盖 income 计算接口。
