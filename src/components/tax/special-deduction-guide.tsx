import React from "react";
import { Card } from "@/components/ui/card";
import { SPECIAL_DEDUCTION_ITEMS } from "@/lib/tax";

interface SpecialDeductionGuideProps {
  className?: string;
}

export function SpecialDeductionGuide({ className }: SpecialDeductionGuideProps) {
  return (
    <Card className={`p-4 ${className}`}>
      <h3 className="text-lg font-semibold mb-3 text-gray-800">专项附加扣除说明</h3>
      <p className="text-sm text-gray-600 mb-4">
        专项附加扣除是指个人所得税法规定的子女教育、继续教育、大病医疗、住房贷款利息、住房租金、赡养老人、3岁以下婴幼儿照护等7项专项附加扣除。
        在填写时，请将您所有适用的专项附加扣除项目加总后填入。
      </p>

      <div className="space-y-3">
        {SPECIAL_DEDUCTION_ITEMS.map((item) => (
          <div key={item.key} className="border-l-4 border-blue-200 pl-3">
            <h4 className="font-medium text-gray-800">{item.label}</h4>
            <p className="text-sm text-gray-600">{item.description}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-sm text-yellow-800">
          <strong>温馨提示：</strong>
          专项附加扣除需要符合税法规定的条件，并留存相关资料备查。
          请根据您的实际情况填写，确保数据的真实性和准确性。
        </p>
      </div>
    </Card>
  );
}

interface SpecialDeductionInputProps {
  value: number;
  onChange: (value: number) => void;
  showGuide?: boolean;
  className?: string;
}

export function SpecialDeductionInput({
  value,
  onChange,
  showGuide = true,
  className,
}: SpecialDeductionInputProps) {
  return (
    <div className={className}>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">专项附加扣除总额（元/月）</label>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          min="0"
          step="100"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="请输入专项附加扣除总额"
        />
        <p className="text-xs text-gray-500">
          包括子女教育、继续教育、大病医疗、住房贷款利息、住房租金、赡养老人、婴幼儿照护等项目的总和
        </p>
      </div>

      {showGuide && (
        <div className="mt-4">
          <SpecialDeductionGuide />
        </div>
      )}
    </div>
  );
}
