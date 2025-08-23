// Lightweight HTML text parsers for Chinese official notices

function toNumber(input: string | undefined | null): number | undefined {
  if (!input) return undefined;
  const cleaned = input.replace(/[\s,，]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function toRate(input: string | undefined | null): number | undefined {
  if (!input) return undefined;
  const m = input.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return undefined;
  return n / 100;
}

export interface SihfParsed {
  baseMin?: number;
  baseMax?: number;
  pensionRate?: number;
  medicalRate?: number;
  unemploymentRate?: number;
}

export function parseSihfFromHtml(html: string): SihfParsed {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  // 基数上下限
  const min1 = text.match(/(下限|下线)[^0-9]{0,6}([0-9,，]{3,9})\s*元?/);
  const max1 = text.match(/(上限|上线)[^0-9]{0,6}([0-9,，]{3,9})\s*元?/);
  const baseMin = toNumber(min1?.[2]);
  const baseMax = toNumber(max1?.[2]);

  // 个人缴费比例（常见表述：养老保险个人缴费比例8%）
  const pens = text.match(/养老保险[^%]{0,10}(个人)?[^0-9]{0,6}([0-9.]+)\s*%/);
  const med = text.match(/医疗保险[^%]{0,10}(个人)?[^0-9]{0,6}([0-9.]+)\s*%/);
  const unemp = text.match(/失业保险[^%]{0,10}(个人)?[^0-9]{0,6}([0-9.]+)\s*%/);

  return {
    baseMin,
    baseMax,
    pensionRate: toRate(pens?.[2]) ?? undefined,
    medicalRate: toRate(med?.[2]) ?? undefined,
    unemploymentRate: toRate(unemp?.[2]) ?? undefined,
  };
}

export interface GjjParsed {
  baseMin?: number;
  baseMax?: number;
  rateLower?: number;
  rateUpper?: number;
}

export function parseGjjFromHtml(html: string): GjjParsed {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const min1 = text.match(/(下限|下线)[^0-9]{0,6}([0-9,，]{3,9})\s*元?/);
  const max1 = text.match(/(上限|上线)[^0-9]{0,6}([0-9,，]{3,9})\s*元?/);
  // 比例常见表述：单位和个人缴存比例各为X%-Y%
  const range = text.match(/各为\s*([0-9.]+)\s*%\s*[-~—–至到]+\s*([0-9.]+)\s*%/);
  const single = text.match(/缴存比例[^0-9]{0,6}([0-9.]+)\s*%/);

  return {
    baseMin: toNumber(min1?.[2]) ?? undefined,
    baseMax: toNumber(max1?.[2]) ?? undefined,
    rateLower: toRate(range?.[1]) ?? toRate(single?.[1]) ?? undefined,
    rateUpper: toRate(range?.[2]) ?? toRate(single?.[1]) ?? undefined,
  };
}
