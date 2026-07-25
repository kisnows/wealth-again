export type Interval = { start: Date; end?: Date | null };

export function validateNoOverlap(intervals: Interval[]): boolean {
  const list = intervals
    .map((i) => ({
      start: i.start.getTime(),
      end: i.end ? i.end.getTime() : Infinity,
    }))
    .sort((a, b) => a.start - b.start);
  for (let i = 1; i < list.length; i++) {
    const prev = list[i - 1];
    const curr = list[i];
    if (prev.end > curr.start) return false;
  }
  return true;
}
