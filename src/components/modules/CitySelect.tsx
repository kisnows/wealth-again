"use client";

import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAllCities } from "@/lib/api/user";

interface City {
  id: string;
  name: string;
  country: string;
}

interface CitySelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function CitySelect({
  value,
  onValueChange,
  placeholder = "选择城市",
  className,
  disabled,
}: CitySelectProps) {
  const { data: cities, isLoading } = useAllCities();

  const citiesByCountry = useMemo(() => {
    if (!cities || cities.length === 0) return {};
    return cities.reduce((acc, city) => {
      if (!acc[city.country]) {
        acc[city.country] = [];
      }
      acc[city.country].push(city);
      return acc;
    }, {} as Record<string, City[]>);
  }, [cities]);

  const isDisabled = disabled || isLoading || !cities || cities.length === 0;

  const countryNames: Record<string, string> = {
    CN: "中国",
    US: "美国",
    UK: "英国",
    JP: "日本",
    SG: "新加坡",
    HK: "香港",
  };

  return (
    <Select
      value={value}
      onValueChange={onValueChange}
      disabled={isDisabled}
    >
      <SelectTrigger className={className}>
        <SelectValue
          placeholder={isLoading ? "加载中..." : placeholder}
        />
      </SelectTrigger>
      <SelectContent>
        {Object.keys(citiesByCountry).length === 0 ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            暂无可用城市
          </div>
        ) : (
          Object.entries(citiesByCountry).map(([country, countryCities]) => (
            <div key={country}>
              <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                {countryNames[country] || country}
              </div>
              {countryCities.map((city) => (
                <SelectItem key={city.id} value={city.id}>
                  {city.name}
                </SelectItem>
              ))}
            </div>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
