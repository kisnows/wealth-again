"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type PeriodSelectOption = {
  value: string;
  label: string;
};

type PeriodSelectProps = {
  options: PeriodSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  "data-testid"?: string;
};

export default function PeriodSelect({
  options,
  value,
  onChange,
  placeholder = "选择时间范围",
  disabled,
  "data-testid": dataTestId,
}: PeriodSelectProps) {
  return (
    <Select
      data-testid={dataTestId}
      disabled={disabled}
      onValueChange={onChange}
      value={value}
    >
      <SelectTrigger className="w-40">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

