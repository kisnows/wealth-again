"use client";

import { CalculatorIcon, InfoIcon, Loader2, SettingsIcon } from "lucide-react";
import { useMemo, useState } from "react";
import {
  PageContainer,
  PageHeader,
  PageSection,
} from "@/components/modules/layout/PageLayout";
import RulesUpsertForm from "@/components/modules/identity/RulesUpsertForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  type TaxBracketRuleInput,
  upsertTaxBrackets,
  upsertTaxConfig,
  useTaxBrackets,
} from "@/lib/api/rules";
import {
  formatCurrencyLabel,
  resolveCountryCurrency,
} from "@/lib/domain/currency";
import { formatMoney } from "@/lib/domain/money";

/** 中国 2025 年个税税率表示例数据 */
const TAX_BRACKETS_EXAMPLE = [
  {
    name: "中国 2025年 个税税率表",
    data: [
      {
        country: "CN",
        taxYear: 2025,
        position: 1,
        threshold: 36000,
        taxRate: 0.03,
        quickDeduction: 0,
      },
      {
        country: "CN",
        taxYear: 2025,
        position: 2,
        threshold: 144000,
        taxRate: 0.1,
        quickDeduction: 2520,
      },
      {
        country: "CN",
        taxYear: 2025,
        position: 3,
        threshold: 300000,
        taxRate: 0.2,
        quickDeduction: 16920,
      },
      {
        country: "CN",
        taxYear: 2025,
        position: 4,
        threshold: 420000,
        taxRate: 0.25,
        quickDeduction: 31920,
      },
      {
        country: "CN",
        taxYear: 2025,
        position: 5,
        threshold: 660000,
        taxRate: 0.3,
        quickDeduction: 52920,
      },
      {
        country: "CN",
        taxYear: 2025,
        position: 6,
        threshold: 960000,
        taxRate: 0.35,
        quickDeduction: 85920,
      },
      {
        country: "CN",
        taxYear: 2025,
        position: 7,
        threshold: 1000000000,
        taxRate: 0.45,
        quickDeduction: 181920,
      },
    ],
  },
];

/**
 * 类型守卫：校验对象是否为有效的税率档位输入
 * @param value - 待校验的对象
 * @returns 是否为有效的 TaxBracketRuleInput
 */
function isTaxBracketRuleInput(value: unknown): value is TaxBracketRuleInput {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const requiredStrings: Array<keyof TaxBracketRuleInput> = ["country"];
  if (
    requiredStrings.some((key) => {
      const candidate = record[key as string];
      return typeof candidate !== "string" || candidate.trim() === "";
    })
  ) {
    return false;
  }
  const requiredNumbers: Array<keyof TaxBracketRuleInput> = [
    "taxYear",
    "position",
    "threshold",
    "taxRate",
    "quickDeduction",
  ];
  return !requiredNumbers.some((key) => {
    const candidate = record[key as string];
    return typeof candidate !== "number" || Number.isNaN(candidate);
  });
}

/**
 * 税制与税率管理页面组件
 *
 * 提供个人所得税配置的完整管理界面，包括：
 * - 税制基础配置：国家、税年、月度基本扣除额、专项附加扣除
 * - 当前税率表：展示指定国家与税年的累进税率档位
 * - 批量配置：支持 JSON 格式批量导入税率表
 * - 字段说明：税制配置与税率表字段的参考文档
 *
 * 数据来源：
 * - useTaxBrackets: 税率档位列表
 */
export default function TaxRulesPage() {
  const [configForm, setConfigForm] = useState({
    country: "CN",
    taxYear: "2025",
    standardDeduction: "5000",
    specialAdditionalDeduction: "0",
  });
  const [configLoading, setConfigLoading] = useState(false);

  const { data, isLoading } = useTaxBrackets(
    configForm.country,
    Number(configForm.taxYear),
  );
  const brackets = data?.items ?? [];
  const currency = useMemo(
    () => resolveCountryCurrency(configForm.country),
    [configForm.country],
  );
  const currencyLabel = useMemo(
    () => formatCurrencyLabel(currency),
    [currency],
  );

  const handleBracketsSubmit = async (items: unknown[]) => {
    const parsed: TaxBracketRuleInput[] = items.map((item) => {
      if (!isTaxBracketRuleInput(item)) {
        throw new Error("税率表格式不正确，需包含国家、税年、阈值等字段。");
      }
      return {
        country: item.country,
        taxYear: item.taxYear,
        position: item.position,
        threshold: item.threshold,
        taxRate: item.taxRate,
        quickDeduction: item.quickDeduction,
      } satisfies TaxBracketRuleInput;
    });
    await upsertTaxBrackets(parsed);
  };

  const handleConfigSubmit = async () => {
    setConfigLoading(true);
    try {
      await upsertTaxConfig({
        country: configForm.country,
        taxYear: Number(configForm.taxYear),
        standardDeduction: Number(configForm.standardDeduction),
        specialAdditionalDeduction: Number(
          configForm.specialAdditionalDeduction,
        ),
      });
    } finally {
      setConfigLoading(false);
    }
  };

  const onChange = (field: string, value: string) => {
    setConfigForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <PageContainer padding="lg" testId="rules-tax-ui-page">
      <PageHeader
        actions={
          <Badge variant="secondary">
            <SettingsIcon className="h-4 w-4" />
            税务配置
          </Badge>
        }
        description={`管理个人所得税税率表和扣除标准，当前金额单位：${currencyLabel}`}
        overline="Rules"
        testId="rules-tax-ui-header"
        title="税制与税率管理"
      />

      <PageSection
        description={`设置税年、基本扣除额与专项附加扣除，所有金额以 ${currencyLabel} 计。`}
        testId="rules-tax-ui-config"
        title="税制基础配置"
      >
        <form className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2">
            <Label htmlFor="tax-country">国家</Label>
            <Input
              data-testid="rules-tax-form-country"
              id="tax-country"
              onChange={(event) => onChange("country", event.target.value)}
              placeholder="CN"
              value={configForm.country}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tax-year">税年</Label>
            <Input
              data-testid="rules-tax-form-year"
              id="tax-year"
              onChange={(event) => onChange("taxYear", event.target.value)}
              placeholder="2025"
              type="number"
              value={configForm.taxYear}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tax-standard">基本扣除额（月）</Label>
            <div className="relative">
              <Input
                className="pr-14"
                data-testid="rules-tax-form-standard"
                id="tax-standard"
                inputMode="decimal"
                onChange={(event) =>
                  onChange("standardDeduction", event.target.value)
                }
                placeholder="5000"
                type="number"
                value={configForm.standardDeduction}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {currency}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tax-special">专项附加扣除（月）</Label>
            <div className="relative">
              <Input
                className="pr-14"
                data-testid="rules-tax-form-special"
                id="tax-special"
                inputMode="decimal"
                onChange={(event) =>
                  onChange("specialAdditionalDeduction", event.target.value)
                }
                placeholder="0"
                type="number"
                value={configForm.specialAdditionalDeduction}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {currency}
              </span>
            </div>
          </div>
          <div className="flex items-end">
            <Button
              className="w-full"
              data-testid="rules-tax-form-submit"
              disabled={configLoading}
              onClick={handleConfigSubmit}
              type="button"
            >
              {configLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="ml-2">保存中...</span>
                </>
              ) : (
                "保存配置"
              )}
            </Button>
          </div>
        </form>
      </PageSection>

      <PageSection
        description={`${configForm.country.toUpperCase()} - ${configForm.taxYear} 税年的个人所得税税率表，金额以 ${currencyLabel} 展示。`}
        testId="rules-tax-ui-table"
        title="当前税率表"
      >
        {isLoading ? (
          <div className="flex items-center justify-center gap-3 py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            加载税率表...
          </div>
        ) : brackets.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">级数</TableHead>
                  <TableHead className="text-right">年累计应纳税所得额</TableHead>
                  <TableHead className="text-right">税率</TableHead>
                  <TableHead className="text-right">速算扣除数</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {brackets.map((bracket, index) => (
                  <TableRow
                    className={cn(index % 2 === 0 && "bg-muted/40")}
                    key={`${bracket.country}-${bracket.taxYear}-${bracket.position}`}
                  >
                    <TableCell className="text-center font-medium">
                      {bracket.position}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {(() => {
                        const threshold = Number(bracket.threshold);
                        if (index === 0) {
                          return `≤ ${formatMoney(threshold, currency)}`;
                        }
                        const previous = index > 0 ? brackets[index - 1] : null;
                        const previousThreshold = previous
                          ? Number(previous.threshold)
                          : null;
                        if (previousThreshold == null) {
                          return `≤ ${formatMoney(threshold, currency)}`;
                        }
                        if (index === brackets.length - 1) {
                          return `> ${formatMoney(previousThreshold, currency)}`;
                        }
                        return `${formatMoney(previousThreshold, currency)} - ${formatMoney(threshold, currency)}`;
                      })()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className="font-mono" variant="outline">
                        {(Number(bracket.taxRate) * 100).toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatMoney(Number(bracket.quickDeduction), currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-10 text-center text-muted-foreground">
            <InfoIcon className="h-10 w-10 text-muted-foreground/60" />
            <p className="text-base font-medium">暂无税率表</p>
            <p className="text-sm">
              使用下方批量配置功能快速导入累进税率表。
            </p>
          </div>
        )}
      </PageSection>

      <PageSection
        bleed
        contentClassName="border-none bg-transparent p-0 shadow-none"
        description="配置个人所得税的累进税率档位，支持一次性批量导入。"
        testId="rules-tax-ui-bulk"
        title="批量配置税率表"
      >
        <RulesUpsertForm
          description="配置个人所得税的累进税率表，支持多档税率"
          examples={TAX_BRACKETS_EXAMPLE}
          onSubmit={handleBracketsSubmit}
          placeholder={`示例格式：
[
  {
    "country": "CN",
    "taxYear": 2025,
    "position": 1,
    "threshold": 36000,
    "taxRate": 0.03,
    "quickDeduction": 0
  }
]`}
          title="批量配置税率表"
        />
      </PageSection>

      <PageSection
        description="字段说明帮助你快速准备批量导入所需的字段与含义。"
        testId="rules-tax-ui-reference"
        title="字段说明"
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              税制配置字段
            </h4>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="font-mono text-sm">country</TableCell>
                  <TableCell>国家代码</TableCell>
                  <TableCell className="font-mono text-sm">"CN"</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-sm">taxYear</TableCell>
                  <TableCell>税年</TableCell>
                  <TableCell className="font-mono text-sm">2025</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-sm">
                    standardDeduction
                  </TableCell>
                  <TableCell>月度基本扣除额（{currency}）</TableCell>
                  <TableCell className="font-mono text-sm">5000</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-sm">
                    specialAdditionalDeduction
                  </TableCell>
                  <TableCell>月度专项附加扣除（{currency}）</TableCell>
                  <TableCell className="font-mono text-sm">0</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground">
              税率表字段
            </h4>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="font-mono text-sm">position</TableCell>
                  <TableCell>税率档位</TableCell>
                  <TableCell className="font-mono text-sm">1, 2, 3…</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-sm">threshold</TableCell>
                  <TableCell>年度阈值上限（{currency}）</TableCell>
                  <TableCell className="font-mono text-sm">36000</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-sm">taxRate</TableCell>
                  <TableCell>税率（小数形式）</TableCell>
                  <TableCell className="font-mono text-sm">0.03 (3%)</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-sm">
                    quickDeduction
                  </TableCell>
                  <TableCell>速算扣除数（{currency}）</TableCell>
                  <TableCell className="font-mono text-sm">0</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </PageSection>
    </PageContainer>
  );
}
