export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function parseYMD(ymd: string): Date {
  const [y, m, day] = ymd.split("-").map((x) => Number(x));
  return new Date(y, m - 1, day || 1);
}
