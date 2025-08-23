import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function generateIncomeDataForUser() {
  try {
    // 使用实际登录用户的ID
    const userId = '2ade63ca-d5fa-4e27-a080-0c9522fd8b82';
    
    console.log("为用户生成收入数据:", userId);

    // 清除现有收入记录
    await prisma.incomeRecord.deleteMany({
      where: { userId }
    });

    console.log("已清除现有收入记录");

    // 生成过去12个月的收入记录
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    
    // 基本工资和奖金数据
    const baseSalary = 20000; // 月薪20,000元
    const bonusMonths = [12]; // 年终奖在12月
    
    for (let i = 1; i <= 12; i++) {
      const year = currentYear;
      const month = i;
      
      // 计算社保公积金（简化计算）
      const socialInsuranceBase = baseSalary; // 社保基数等于工资
      const housingFundBase = baseSalary; // 公积金基数等于工资
      
      // 社保个人部分（约10.5%）
      const socialInsurance = socialInsuranceBase * 0.105;
      
      // 公积金个人部分（约12%）
      const housingFund = housingFundBase * 0.12;
      
      // 奖金
      const bonus = bonusMonths.includes(month) ? 50000 : 0;
      
      // 税前总收入
      const gross = baseSalary + bonus;
      
      // 专项附加扣除（简化为固定值）
      const specialDeductions = 3000; // 每月专项附加扣除3000元
      
      // 应纳税所得额（简化计算）
      const taxableIncome = Math.max(0, gross - 5000 - socialInsurance - housingFund - specialDeductions);
      
      // 个人所得税（简化计算，实际应该使用累进税率）
      let incomeTax = 0;
      if (taxableIncome > 0) {
        if (taxableIncome <= 36000) {
          incomeTax = taxableIncome * 0.03;
        } else if (taxableIncome <= 144000) {
          incomeTax = taxableIncome * 0.1 - 2520;
        } else if (taxableIncome <= 300000) {
          incomeTax = taxableIncome * 0.2 - 16920;
        } else if (taxableIncome <= 420000) {
          incomeTax = taxableIncome * 0.25 - 31920;
        } else if (taxableIncome <= 660000) {
          incomeTax = taxableIncome * 0.3 - 52920;
        } else if (taxableIncome <= 960000) {
          incomeTax = taxableIncome * 0.35 - 85920;
        } else {
          incomeTax = taxableIncome * 0.45 - 181920;
        }
      }
      
      // 税后收入
      const netIncome = gross - socialInsurance - housingFund - incomeTax;
      
      // 创建收入记录
      await prisma.incomeRecord.create({
        data: {
          userId,
          city: "Hangzhou",
          year,
          month,
          gross: gross.toString(),
          bonus: bonus.toString(),
          socialInsuranceBase: socialInsuranceBase.toString(),
          housingFundBase: housingFundBase.toString(),
          socialInsurance: socialInsurance.toString(),
          housingFund: housingFund.toString(),
          specialDeductions: specialDeductions.toString(),
          taxableIncome: taxableIncome.toString(),
          incomeTax: incomeTax.toString(),
          netIncome: netIncome.toString()
        }
      });
      
      console.log(`已创建 ${year}-${month} 的收入记录`);
    }

    console.log("收入数据生成完成！");
  } catch (error) {
    console.error("生成收入数据时出错:", error);
  } finally {
    await prisma.$disconnect();
  }
}

generateIncomeDataForUser();