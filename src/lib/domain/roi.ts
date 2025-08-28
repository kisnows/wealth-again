export function calcROI(principal: number, valuation: number): number | null {
  if (!principal) return null;
  const roi = (valuation - principal) / principal;
  if (!Number.isFinite(roi)) return null;
  return roi;
}
