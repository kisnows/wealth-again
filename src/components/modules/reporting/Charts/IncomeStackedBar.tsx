"use client";

type MonthValue = { month: string; [k: string]: number | string };

const KEYS = [
  "gross",
  "bonus",
  "ltcIncome",
  "equityIncome",
  "socialInsurance",
  "housingFund",
  "incomeTax",
] as const;
const COLORS = [
  "#60a5fa",
  "#34d399",
  "#fbbf24",
  "#f472b6",
  "#a78bfa",
  "#fb7185",
  "#94a3b8",
];

export default function IncomeStackedBar({
  items = [] as MonthValue[],
}: {
  items?: MonthValue[];
}) {
  if (!items.length)
    return (
      <div className="border rounded p-6 text-sm text-muted-foreground">
        暂无时序数据
      </div>
    );
  const w = 640,
    h = 220,
    pad = 24,
    bw = Math.max(8, (w - pad * 2) / items.length - 6);
  const sums = items.map((d) =>
    KEYS.reduce((s, k) => s + Number(d[k] || 0), 0),
  );
  const maxSum = Math.max(1, ...sums);
  const x = (i: number) => pad + i * (bw + 6);
  const y = (v: number) => h - pad - (v / maxSum) * (h - pad * 2);
  return (
    <div className="border rounded p-3 overflow-auto">
      <svg height={h} width={w}>
        {items.map((d, i) => {
          let acc = 0;
          return (
            <g key={i} transform={`translate(${x(i)},0)`}>
              {KEYS.map((k, ki) => {
                const v = Number(d[k] || 0);
                const y1 = y(acc + v);
                const y0 = y(acc);
                acc += v;
                return (
                  <rect
                    fill={COLORS[ki % COLORS.length]}
                    height={Math.max(0, y0 - y1)}
                    key={ki}
                    width={bw}
                    x={0}
                    y={y1}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
