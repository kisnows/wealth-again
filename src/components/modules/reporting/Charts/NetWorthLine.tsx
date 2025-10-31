"use client";

type Point = { x: string; y: number };

export default function NetWorthLine({
  data = [] as Point[],
}: {
  data?: Point[];
}) {
  if (!data.length)
    return (
      <div className="border rounded p-6 text-sm text-muted-foreground">
        暂无数据
      </div>
    );
  const w = 600,
    h = 180,
    pad = 24;
  const xs = data.map((_d, i) => i);
  const ys = data.map((d) => d.y);
  const xmin = 0,
    xmax = xs.length - 1;
  const ymin = Math.min(...ys),
    ymax = Math.max(...ys);
  const sx = (i: number) =>
    pad + ((i - xmin) / Math.max(1, xmax - xmin)) * (w - pad * 2);
  const sy = (v: number) =>
    h - pad - ((v - ymin) / Math.max(1, ymax - ymin)) * (h - pad * 2);
  const path = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${sx(i)},${sy(d.y)}`)
    .join(" ");
  return (
    <div className="border rounded p-3 overflow-auto">
      <svg className="block" height={h} width={w}>
        <path
          className="text-blue-600"
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        />
      </svg>
    </div>
  );
}
