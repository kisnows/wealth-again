export function inferTransferToAmount(
  fromAmount: number,
  fromCurrency: string,
  toCurrency: string,
  fxRate: number,
): number {
  if (fromCurrency === toCurrency) return Math.abs(fromAmount);
  // Assume fxRate is base=from, quote=to per unit
  return Math.abs(fromAmount) * fxRate;
}
