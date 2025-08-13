// 导出所有类型定义
export * from "./types";

// 导出核心服务
export { TaxService } from "./service";
export { TaxConfigRepository } from "./repository";
export { TaxCalculator, SocialInsuranceCalculator } from "./calculator";

// 导出工具函数和常量
export { SPECIAL_DEDUCTION_ITEMS } from "./types";

// 创建服务实例的工厂函数
import { PrismaClient } from "@prisma/client";
import { TaxConfigRepository } from "./repository";
import { TaxService } from "./service";

let taxServiceInstance: TaxService | null = null;

export function createTaxService(prisma: PrismaClient): TaxService {
  if (!taxServiceInstance) {
    const repository = new TaxConfigRepository(prisma);
    taxServiceInstance = new TaxService(repository);
  }
  return taxServiceInstance;
}

// 重置实例（主要用于测试）
export function resetTaxService(): void {
  taxServiceInstance = null;
}
