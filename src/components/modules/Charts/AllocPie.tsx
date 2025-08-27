"use client";

type Slice = { name: string; value: number; color?: string };

export default function AllocPie({ data = [] as Slice[] }: { data?: Slice[] }) {
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0);
  if (!total) return <div className="border rounded p-6 text-sm text-muted-foreground">暂无分配数据</div>;
  const r = 70, cx = 90, cy = 90;
  let start = 0;
  const slices = data.map((d, i) => {
    const frac = Math.max(0, d.value) / total;
    const end = start + frac * Math.PI * 2;
    const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
    const large = end - start > Math.PI ? 1 : 0;
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    start = end;
    const color = d.color ?? ["#60a5fa", "#34d399", "#f472b6", "#fbbf24"][i % 4];
    return { path, color, name: d.name, pct: Math.round(frac * 100) };
  });
  return (
    <div className="flex gap-4 items-center border rounded p-3">
      <svg width={180} height={180}>
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} className="opacity-90" />
        ))}
      </svg>
      <ul className="text-sm">
        {slices.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded" style={{ background: s.color }} />
            <span className="text-muted-foreground">{s.name}</span>
            <span className="ml-2 font-medium">{s.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

