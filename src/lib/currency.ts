import { prisma } from "@/lib/prisma";

/**
 * 格式化货币金额，添加千位分隔符
 * @param amount 金额
 * @param currency 货币符号，默认为¥
 * @returns 格式化后的货币字符串
 */
export function formatCurrencyWithSeparator(amount: number | string, currency: string = "¥"): string {
  // 转换为数字
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  
  // 检查是否为有效数字
  if (isNaN(num)) {
    return `${currency}0.00`;
  }
  
  // 格式化为带有千位分隔符的字符串
  return `${currency}${num.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

/**
 * 获取指定日期的汇率
 * @param base 基础货币
 * @param quote 报价货币
 * @param asOf 日期
 * @returns 汇率值
 */
export async function getFxRate(base: string, quote: string, asOf: Date): Promise<number> {
  // 如果基础货币和报价货币相同，返回1
  if (base === quote) {
    return 1;
  }
  
  // 查找指定日期或之前的最近汇率
  const fxRate = await prisma.fxRate.findFirst({
    where: {
      base,
      quote,
      asOf: {
        lte: asOf
      }
    },
    orderBy: {
      asOf: 'desc'
    }
  });
  
  return fxRate ? Number(fxRate.rate) : 1;
}

/**
 * 货币转换
 * @param amount 金额
 * @param fromCurrency 源货币
 * @param toCurrency 目标货币
 * @param asOf 日期
 * @returns 转换后的金额
 */
export async function convertCurrency(
  amount: number, 
  fromCurrency: string, 
  toCurrency: string, 
  asOf: Date
): Promise<number> {
  // 如果源货币和目标货币相同，直接返回原金额
  if (fromCurrency === toCurrency) {
    return amount;
  }
  
  // 获取汇率
  const rate = await getFxRate(fromCurrency, toCurrency, asOf);
  
  // 转换金额
  return amount * rate;
}

/**
 * 获取账户以基础货币计算的价值
 * @param accountId 账户ID
 * @param asOf 日期
 * @returns 以账户基础货币计算的价值
 */
export async function getAccountValueInBaseCurrency(accountId: string, asOf: Date): Promise<number> {
  // 获取账户信息
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: {
      snapshots: {
        where: {
          asOf: {
            lte: asOf
          }
        },
        orderBy: {
          asOf: 'desc'
        },
        take: 1
      }
    }
  });
  
  if (!account) {
    throw new Error("账户不存在");
  }
  
  // 获取最新的快照价值
  const snapshot = account.snapshots[0];
  const snapshotValue = snapshot ? Number(snapshot.totalValue) : 0;
  
  // 如果快照货币与账户基础货币相同，直接返回
  if (snapshot && account.baseCurrency === snapshot.currency) {
    return snapshotValue;
  }
  
  // 否则进行货币转换
  if (snapshot) {
    return await convertCurrency(
      snapshotValue,
      snapshot.currency,
      account.baseCurrency,
      asOf
    );
  }
  
  return 0;
}