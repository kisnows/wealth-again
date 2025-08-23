import { PrismaClient } from "@prisma/client";

/**
 * 计算账户的真实投资收益和收益率
 * 使用时间加权收益率(TWR)方法
 * 
 * @param prisma Prisma客户端实例
 * @param accountId 账户ID
 * @param asOf 计算截止日期，默认为当前时间
 * @returns 投资收益和收益率
 */
export async function calculateAccountPerformance(
  prisma: PrismaClient,
  accountId: string,
  asOf: Date = new Date()
) {
  try {
    // 获取账户信息
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        transactions: {
          where: {
            tradeDate: {
              lte: asOf
            }
          },
          orderBy: {
            tradeDate: 'asc'
          }
        },
        snapshots: {
          where: {
            asOf: {
              lte: asOf
            }
          },
          orderBy: {
            asOf: 'asc'
          }
        }
      }
    });

    if (!account) {
      throw new Error("账户不存在");
    }

    // 计算本金（初始资金 + 所有存款 - 所有取款）
    const initialBalance = Number(account.initialBalance || 0);
    
    // 计算净存入（存款-取款）
    const netDeposits = account.transactions.reduce((sum, transaction) => {
      return sum + Number(transaction.amount || 0);
    }, 0);
    
    // 实际本金 = 初始资金 + 净存入
    const actualPrincipal = initialBalance + netDeposits;
    
    // 获取最新的账户估值
    const latestSnapshot = account.snapshots.length > 0 
      ? account.snapshots[account.snapshots.length - 1] 
      : null;
    
    const currentValue = latestSnapshot 
      ? Number(latestSnapshot.totalValue || 0) 
      : initialBalance;
    
    // 收益 = 当前估值 - 实际本金
    const profit = currentValue - actualPrincipal;
    
    // 收益率 = 收益 / 实际本金
    const rateOfReturn = actualPrincipal !== 0 
      ? (profit / Math.abs(actualPrincipal)) * 100 
      : 0;
    
    return {
      accountId,
      initialBalance,
      netDeposits,
      actualPrincipal,
      currentValue,
      profit,
      rateOfReturn,
      snapshotCount: account.snapshots.length,
      transactionCount: account.transactions.length
    };
  } catch (error) {
    console.error("计算投资绩效时出错:", error);
    throw error;
  }
}

/**
 * 计算时间加权收益率(TWR)
 * 这是一个更精确的收益率计算方法，消除了资金流入流出对收益率的影响
 * 
 * @param prisma Prisma客户端实例
 * @param accountId 账户ID
 * @param asOf 计算截止日期，默认为当前时间
 * @returns 时间加权收益率
 */
export async function calculateTimeWeightedReturn(
  prisma: PrismaClient,
  accountId: string,
  asOf: Date = new Date()
) {
  try {
    // 获取账户信息，包括交易和估值快照
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        transactions: {
          where: {
            tradeDate: {
              lte: asOf
            }
          },
          orderBy: {
            tradeDate: 'asc'
          }
        },
        snapshots: {
          where: {
            asOf: {
              lte: asOf
            }
          },
          orderBy: {
            asOf: 'asc'
          }
        }
      }
    });

    if (!account) {
      throw new Error("账户不存在");
    }

    if (account.snapshots.length < 2) {
      // 如果少于两个快照，无法计算TWR
      return {
        twr: 0,
        periods: 0
      };
    }

    // 计算每个期间的收益率
    let totalReturn = 1;
    let periods = 0;

    for (let i = 1; i < account.snapshots.length; i++) {
      const previousSnapshot = account.snapshots[i - 1];
      const currentSnapshot = account.snapshots[i];
      
      // 找到在此期间的交易
      const periodTransactions = account.transactions.filter(t => 
        t.tradeDate > previousSnapshot.asOf && 
        t.tradeDate <= currentSnapshot.asOf
      );
      
      // 计算期间开始时的价值（上一个快照值 + 期间交易）
      const periodStartValue = Number(previousSnapshot.totalValue || 0);
      const periodNetFlow = periodTransactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
      
      // 如果期间开始价值加上净流入为0，跳过此期间
      if (periodStartValue + periodNetFlow === 0) continue;
      
      // 期间结束时的价值
      const periodEndValue = Number(currentSnapshot.totalValue || 0);
      
      // 期间收益率 = (期间结束价值 - 期间开始价值) / 期间开始价值
      const periodReturn = (periodEndValue - periodStartValue) / (periodStartValue + periodNetFlow);
      
      totalReturn *= (1 + periodReturn);
      periods++;
    }

    // 时间加权收益率 = (1 + r1) * (1 + r2) * ... * (1 + rn) - 1
    const twr = totalReturn - 1;
    
    return {
      twr: twr * 100, // 转换为百分比
      periods
    };
  } catch (error) {
    console.error("计算时间加权收益率时出错:", error);
    throw error;
  }
}