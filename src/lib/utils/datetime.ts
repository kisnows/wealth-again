/**
 * 将 Date 转换为 `<input type="datetime-local" />` 可用的本地时间字符串。
 */
export function toInputDatetimeValue(date: Date) {
  const tzOffsetMinutes = date.getTimezoneOffset();
  const localTime = new Date(date.getTime() - tzOffsetMinutes * 60_000);
  return localTime.toISOString().slice(0, 16);
}
