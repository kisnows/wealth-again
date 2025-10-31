"use client";

import {
  AwardIcon,
  CalendarIcon,
  DollarSignIcon,
  InfoIcon,
  Loader2,
  TrendingUpIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUserId } from "@/lib/api/auth";
import {
  createBonus,
  createEquityGrant,
  createLTCPlan,
  createSalaryChange,
  generateEquityVests,
  generateLTCPayouts,
} from "@/lib/api/income";
import { notifyAsync } from "@/lib/utils/notify";

// 表单验证工具函数
const _validateRequired = (value: string, field: string) => {
  if (!value.trim()) return `${field}不能为空`;
  return "";
};

const validateNumber = (
  value: string,
  field: string,
  min?: number,
  max?: number,
) => {
  const num = Number(value);
  if (Number.isNaN(num)) return `${field}必须为数字`;
  if (min !== undefined && num < min) return `${field}不能小于${min}`;
  if (max !== undefined && num > max) return `${field}不能大于${max}`;
  return "";
};

const validateDate = (value: string, field: string) => {
  if (!value) return `${field}不能为空`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return `${field}格式不正确`;
  return "";
};

// 通用表单容器组件
interface FormFieldProps {
  label: string;
  error?: string;
  description?: string;
  required?: boolean;
  children: React.ReactNode;
}

function FormField({
  label,
  error,
  description,
  required = false,
  children,
}: FormFieldProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {children}
      {description && (
        <p className="text-xs text-gray-500 flex items-center gap-1">
          <InfoIcon className="w-3 h-3" />
          {description}
        </p>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function SalaryChangeForm() {
  const currentUserId = useCurrentUserId();
  const [form, setForm] = useState({
    grossMonthly: "",
    currency: "CNY",
    effectiveFrom: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    newErrors.grossMonthly = validateNumber(form.grossMonthly, "税前月薪", 0);
    newErrors.effectiveFrom = validateDate(form.effectiveFrom, "生效日期");

    setErrors(newErrors);
    return !Object.values(newErrors).some((error) => error);
  };

  const onChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // 清除该字段的错误
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUserId) {
      toast.error("用户未登录");
      return;
    }

    if (!validateForm()) {
      toast.error("请检查表单输入");
      return;
    }

    setLoading(true);
    try {
      await notifyAsync(
        () =>
          createSalaryChange({
            userId: currentUserId,
            grossMonthly: Number(form.grossMonthly),
            currency: form.currency,
            effectiveFrom: new Date(form.effectiveFrom).toISOString(),
          }),
        {
          loading: "正在创建工资变更…",
          success: "工资变更已创建",
          error: "创建失败，请重试",
        },
      );

      // 清空表单
      setForm({
        grossMonthly: "",
        currency: "CNY",
        effectiveFrom: "",
      });
    } catch (error) {
      console.error("create salary change error", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSignIcon className="w-5 h-5 text-green-600" />
          工资变更
        </CardTitle>
        <CardDescription>记录工资调整，支持同月多次变更</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <FormField
            description="新的月度税前工资金额"
            error={errors.grossMonthly}
            label="税前月薪"
            required
          >
            <div className="relative">
              <Input
                className="pr-12"
                disabled={loading}
                min="0"
                onChange={(e) => onChange("grossMonthly", e.target.value)}
                placeholder="0.00"
                step="0.01"
                type="number"
                value={form.grossMonthly}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                {form.currency}
              </div>
            </div>
          </FormField>

          <FormField description="工资发放的货币" label="币种">
            <Select
              onValueChange={(value) => onChange("currency", value)}
              value={form.currency}
            >
              <SelectTrigger disabled={loading}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CNY">人民币 (CNY)</SelectItem>
                <SelectItem value="USD">美元 (USD)</SelectItem>
                <SelectItem value="HKD">港币 (HKD)</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            description="工资变更的生效日期（当月生效）"
            error={errors.effectiveFrom}
            label="生效日期"
            required
          >
            <Input
              disabled={loading}
              onChange={(e) => onChange("effectiveFrom", e.target.value)}
              type="date"
              value={form.effectiveFrom}
            />
          </FormField>

          <Button className="w-full" disabled={loading} type="submit">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                创建中...
              </>
            ) : (
              "创建工资变更"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function BonusForm() {
  const currentUserId = useCurrentUserId();
  const [form, setForm] = useState({
    amount: "",
    currency: "CNY",
    effectiveDate: "",
    taxMethod: "MERGE",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    newErrors.amount = validateNumber(form.amount, "奖金金额", 0);
    newErrors.effectiveDate = validateDate(form.effectiveDate, "发放日期");

    setErrors(newErrors);
    return !Object.values(newErrors).some((error) => error);
  };

  const onChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUserId) {
      toast.error("用户未登录");
      return;
    }

    if (!validateForm()) {
      toast.error("请检查表单输入");
      return;
    }

    setLoading(true);
    try {
      await notifyAsync(
        () =>
          createBonus({
            userId: currentUserId,
            amount: Number(form.amount),
            currency: form.currency,
            taxMethod: form.taxMethod,
            effectiveDate: new Date(form.effectiveDate).toISOString(),
          }),
        {
          loading: "正在创建奖金记录…",
          success: "一次性奖金已创建",
          error: "创建失败，请重试",
        },
      );
      setForm({
        amount: "",
        currency: "CNY",
        effectiveDate: "",
        taxMethod: "MERGE",
      });
    } catch (error) {
      console.error("create bonus error", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AwardIcon className="w-5 h-5 text-yellow-600" />
          一次性奖金
        </CardTitle>
        <CardDescription>设置项目奖金、年终奖等一次性收入</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <FormField
            description="一次性奖金的金额"
            error={errors.amount}
            label="奖金金额"
            required
          >
            <div className="relative">
              <Input
                className="pr-12"
                disabled={loading}
                min="0"
                onChange={(e) => onChange("amount", e.target.value)}
                placeholder="0.00"
                step="0.01"
                type="number"
                value={form.amount}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                {form.currency}
              </div>
            </div>
          </FormField>

          <FormField label="币种">
            <Select
              onValueChange={(value) => onChange("currency", value)}
              value={form.currency}
            >
              <SelectTrigger disabled={loading}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CNY">人民币 (CNY)</SelectItem>
                <SelectItem value="USD">美元 (USD)</SelectItem>
                <SelectItem value="HKD">港币 (HKD)</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField description="选择奖金的个税计算方式" label="计税方式">
            <Select
              onValueChange={(value) => onChange("taxMethod", value)}
              value={form.taxMethod}
            >
              <SelectTrigger disabled={loading}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MERGE">并入工资综合计税</SelectItem>
                <SelectItem value="SEPARATE">单独计税</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            description="奖金发放日期，将在当月与工资合并发放"
            error={errors.effectiveDate}
            label="发放日期"
            required
          >
            <Input
              disabled={loading}
              onChange={(e) => onChange("effectiveDate", e.target.value)}
              type="date"
              value={form.effectiveDate}
            />
          </FormField>

          <Button className="w-full" disabled={loading} type="submit">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                创建中...
              </>
            ) : (
              "创建奖金计划"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function LTCPlanForm() {
  const currentUserId = useCurrentUserId();
  const [form, setForm] = useState({
    totalAmount: "",
    currency: "CNY",
    startDate: "",
    periods: "16",
    recurrence: "QUARTERLY",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    newErrors.totalAmount = validateNumber(form.totalAmount, "总金额", 0);
    newErrors.startDate = validateDate(form.startDate, "开始日期");
    newErrors.periods = validateNumber(form.periods, "期数", 1, 100);

    setErrors(newErrors);
    return !Object.values(newErrors).some((error) => error);
  };

  const onChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUserId) {
      toast.error("用户未登录");
      return;
    }

    if (!validateForm()) {
      toast.error("请检查表单输入");
      return;
    }

    setLoading(true);
    try {
      await notifyAsync(
        async () => {
          const created = await createLTCPlan({
            userId: currentUserId,
            totalAmount: Number(form.totalAmount),
            currency: form.currency,
            startDate: new Date(form.startDate).toISOString(),
            periods: Number(form.periods),
            recurrence: form.recurrence,
          });

          await generateLTCPayouts((created as any).id);
          return created;
        },
        {
          loading: "正在创建长期现金计划…",
          success: "长期现金计划已创建并生成发放日程",
          error: "创建失败，请重试",
        },
      );
      setForm({
        totalAmount: "",
        currency: "CNY",
        startDate: "",
        periods: "16",
        recurrence: "QUARTERLY",
      });
    } catch (error) {
      console.error("create ltc plan error", error);
    } finally {
      setLoading(false);
    }
  };

  const perPeriodAmount =
    form.totalAmount && form.periods
      ? (Number(form.totalAmount) / Number(form.periods)).toFixed(2)
      : "0.00";

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUpIcon className="w-5 h-5 text-blue-600" />
          长期现金计划
        </CardTitle>
        <CardDescription>设置分期发放的长期现金激励</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <FormField
            description="长期现金激励的总金额"
            error={errors.totalAmount}
            label="总金额"
            required
          >
            <div className="relative">
              <Input
                className="pr-12"
                disabled={loading}
                min="0"
                onChange={(e) => onChange("totalAmount", e.target.value)}
                placeholder="0.00"
                step="0.01"
                type="number"
                value={form.totalAmount}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                {form.currency}
              </div>
            </div>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              description="分几期发放"
              error={errors.periods}
              label="期数"
              required
            >
              <Input
                disabled={loading}
                max="100"
                min="1"
                onChange={(e) => onChange("periods", e.target.value)}
                type="number"
                value={form.periods}
              />
            </FormField>

            <FormField description="发放频率" label="频率">
              <Select
                onValueChange={(value) => onChange("recurrence", value)}
                value={form.recurrence}
              >
                <SelectTrigger disabled={loading}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">每月</SelectItem>
                  <SelectItem value="QUARTERLY">每季度</SelectItem>
                  <SelectItem value="YEARLY">每年</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <FormField label="币种">
            <Select
              onValueChange={(value) => onChange("currency", value)}
              value={form.currency}
            >
              <SelectTrigger disabled={loading}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CNY">人民币 (CNY)</SelectItem>
                <SelectItem value="USD">美元 (USD)</SelectItem>
                <SelectItem value="HKD">港币 (HKD)</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            description="第一期发放日期"
            error={errors.startDate}
            label="开始日期"
            required
          >
            <Input
              disabled={loading}
              onChange={(e) => onChange("startDate", e.target.value)}
              type="date"
              value={form.startDate}
            />
          </FormField>

          {form.totalAmount && form.periods && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>每期金额：</strong>
                {perPeriodAmount} {form.currency}
              </p>
            </div>
          )}

          <Button className="w-full" disabled={loading} type="submit">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                创建并生成日程...
              </>
            ) : (
              "创建长期现金计划"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function EquityGrantForm() {
  const currentUserId = useCurrentUserId();
  const [form, setForm] = useState({
    totalUnits: "",
    currency: "CNY",
    startVestDate: "",
    vestPeriods: "4",
    vestInterval: "YEARLY",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    newErrors.totalUnits = validateNumber(form.totalUnits, "总份额", 0);
    newErrors.startVestDate = validateDate(form.startVestDate, "开始归属日");
    newErrors.vestPeriods = validateNumber(form.vestPeriods, "归属期数", 1, 20);

    setErrors(newErrors);
    return !Object.values(newErrors).some((error) => error);
  };

  const onChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUserId) {
      toast.error("用户未登录");
      return;
    }

    if (!validateForm()) {
      toast.error("请检查表单输入");
      return;
    }

    setLoading(true);
    try {
      await notifyAsync(
        async () => {
          const created = await createEquityGrant({
            userId: currentUserId,
            totalUnits: Number(form.totalUnits),
            currency: form.currency,
            startVestDate: new Date(form.startVestDate).toISOString(),
            vestPeriods: Number(form.vestPeriods),
            vestInterval: form.vestInterval,
          });

          await generateEquityVests((created as any).id);
          return created;
        },
        {
          loading: "正在创建股权授予…",
          success: "股权授予已创建并生成归属日程",
          error: "创建失败，请重试",
        },
      );
      setForm({
        totalUnits: "",
        currency: "CNY",
        startVestDate: "",
        vestPeriods: "4",
        vestInterval: "YEARLY",
      });
    } catch (error) {
      console.error("create equity grant error", error);
    } finally {
      setLoading(false);
    }
  };

  const unitsPerPeriod =
    form.totalUnits && form.vestPeriods
      ? (Number(form.totalUnits) / Number(form.vestPeriods)).toFixed(0)
      : "0";

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-purple-600" />
          股权授予
        </CardTitle>
        <CardDescription>设置股权激励的授予与归属计划</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <FormField
            description="股权激励的总份额数量"
            error={errors.totalUnits}
            label="总份额"
            required
          >
            <Input
              disabled={loading}
              min="0"
              onChange={(e) => onChange("totalUnits", e.target.value)}
              placeholder="0"
              step="1"
              type="number"
              value={form.totalUnits}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              description="分几期归属"
              error={errors.vestPeriods}
              label="归属期数"
              required
            >
              <Input
                disabled={loading}
                max="20"
                min="1"
                onChange={(e) => onChange("vestPeriods", e.target.value)}
                type="number"
                value={form.vestPeriods}
              />
            </FormField>

            <FormField description="归属频率" label="归属频率">
              <Select
                onValueChange={(value) => onChange("vestInterval", value)}
                value={form.vestInterval}
              >
                <SelectTrigger disabled={loading}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="QUARTERLY">每季度</SelectItem>
                  <SelectItem value="YEARLY">每年</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <FormField description="用于税务计算" label="币种">
            <Select
              onValueChange={(value) => onChange("currency", value)}
              value={form.currency}
            >
              <SelectTrigger disabled={loading}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CNY">人民币 (CNY)</SelectItem>
                <SelectItem value="USD">美元 (USD)</SelectItem>
                <SelectItem value="HKD">港币 (HKD)</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            description="第一期归属日期"
            error={errors.startVestDate}
            label="开始归属日"
            required
          >
            <Input
              disabled={loading}
              onChange={(e) => onChange("startVestDate", e.target.value)}
              type="date"
              value={form.startVestDate}
            />
          </FormField>

          {form.totalUnits && form.vestPeriods && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="text-sm text-purple-800">
                <strong>每期归属：</strong>
                {unitsPerPeriod} 份额
              </p>
            </div>
          )}

          <Button className="w-full" disabled={loading} type="submit">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                创建并生成归属...
              </>
            ) : (
              "创建股权授予"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function IncomeForms() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <SalaryChangeForm />
      <BonusForm />
      <LTCPlanForm />
      <EquityGrantForm />
    </div>
  );
}
