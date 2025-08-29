"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
}

export default function CitySelect({ 
  value, 
  onValueChange, 
  placeholder = "选择城市",
  className 
}: CitySelectProps) {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/cities")
      .then((res) => res.json())
      .then((data) => setCities(data))
      .catch((error) => console.error("Failed to fetch cities:", error))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger className={className}>
          <SelectValue placeholder="加载中..." />
        </SelectTrigger>
      </Select>
    );
  }

  // Group cities by country
  const citiesByCountry = cities.reduce((acc, city) => {
    if (!acc[city.country]) {
      acc[city.country] = [];
    }
    acc[city.country].push(city);
    return acc;
  }, {} as Record<string, City[]>);

  const countryNames: Record<string, string> = {
    CN: "中国",
    US: "美国",
    UK: "英国",
    JP: "日本",
    SG: "新加坡",
    HK: "香港",
  };

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(citiesByCountry).map(([country, countryCities]) => (
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
        ))}
      </SelectContent>
    </Select>
  );
}
