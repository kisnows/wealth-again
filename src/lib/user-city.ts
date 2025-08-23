import { prisma } from "./prisma";

/**
 * 用户城市管理相关的工具函数
 * 用于处理用户城市历史和动态查询用户在特定时间的城市
 */

/**
 * 获取用户在指定时间的工作城市
 * 这个函数用于社保、公积金计算时确定应该使用哪个城市的政策
 * 
 * @param userId - 用户ID
 * @param date - 查询日期，默认为当前时间
 * @returns 用户在指定时间的城市
 */
export async function getUserCityAtDate(userId: string, date: Date = new Date()): Promise<string> {
  // 查询用户在指定日期有效的城市记录
  const cityHistory = await prisma.userCityHistory.findFirst({
    where: {
      userId,
      effectiveFrom: { lte: date },
      OR: [
        { effectiveTo: null }, // 当前城市（effectiveTo为null）
        { effectiveTo: { gte: date } } // 或者在有效期内
      ]
    },
    orderBy: { effectiveFrom: 'desc' } // 按生效时间降序，取最新的记录
  });

  // 如果找到了城市历史记录，返回该城市
  if (cityHistory) {
    return cityHistory.city;
  }

  // 如果没有找到城市历史记录，返回用户的当前城市
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { currentCity: true }
  });

  if (!user) {
    throw new Error(`用户不存在: ${userId}`);
  }

  return user.currentCity;
}

/**
 * 获取用户当前的工作城市
 * 
 * @param userId - 用户ID
 * @returns 用户当前的城市
 */
export async function getUserCurrentCity(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { currentCity: true }
  });

  if (!user) {
    throw new Error(`用户不存在: ${userId}`);
  }

  return user.currentCity;
}

/**
 * 更新用户的城市（创建新的城市历史记录）
 * 
 * @param userId - 用户ID
 * @param newCity - 新的城市
 * @param effectiveFrom - 生效日期，默认为当前时间
 * @param note - 备注信息
 */
export async function updateUserCity(
  userId: string, 
  newCity: string, 
  effectiveFrom: Date = new Date(),
  note?: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // 1. 结束当前的城市记录（如果存在）
    await tx.userCityHistory.updateMany({
      where: {
        userId,
        effectiveTo: null // 当前有效的记录
      },
      data: {
        effectiveTo: effectiveFrom
      }
    });

    // 2. 创建新的城市记录
    await tx.userCityHistory.create({
      data: {
        userId,
        city: newCity,
        effectiveFrom,
        note: note || `城市变更为${newCity}`
      }
    });

    // 3. 更新用户表的当前城市
    await tx.user.update({
      where: { id: userId },
      data: { currentCity: newCity }
    });
  });
}

/**
 * 获取用户的城市变更历史
 * 
 * @param userId - 用户ID
 * @returns 城市历史记录列表，按时间倒序排列
 */
export async function getUserCityHistory(userId: string) {
  return await prisma.userCityHistory.findMany({
    where: { userId },
    orderBy: { effectiveFrom: 'desc' }
  });
}

/**
 * 获取系统支持的城市列表
 * 从社保配置表中提取所有配置过的城市
 */
export async function getSupportedCities(): Promise<string[]> {
  const cities = await prisma.socialInsuranceConfig.findMany({
    select: { city: true },
    distinct: ['city']
  });

  return cities.map(c => c.city);
}

/**
 * 验证城市是否被系统支持
 * 
 * @param city - 城市名称
 * @returns 是否支持该城市
 */
export async function isCitySupported(city: string): Promise<boolean> {
  const supportedCities = await getSupportedCities();
  return supportedCities.includes(city);
}

/**
 * 获取用户在一个时间范围内的城市变更情况
 * 这个函数对于收入预测和税收计算特别有用
 * 
 * @param userId - 用户ID
 * @param startDate - 开始日期
 * @param endDate - 结束日期
 * @returns 时间范围内的城市信息列表
 */
export async function getUserCitiesInRange(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{ city: string; effectiveFrom: Date; effectiveTo: Date | null }>> {
  const cityHistories = await prisma.userCityHistory.findMany({
    where: {
      userId,
      OR: [
        // 记录开始时间在范围内
        { effectiveFrom: { gte: startDate, lte: endDate } },
        // 记录结束时间在范围内
        { effectiveTo: { gte: startDate, lte: endDate } },
        // 记录跨越整个范围
        { 
          effectiveFrom: { lte: startDate },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: endDate } }
          ]
        }
      ]
    },
    orderBy: { effectiveFrom: 'asc' }
  });

  return cityHistories;
}