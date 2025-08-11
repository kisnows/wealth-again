import { prisma } from "../src/lib/prisma";

async function main() {
  try {
    const city = "Hangzhou";
    const year = 2025;
    const key = `tax:${city}:${year}`;
    const data = {
      city,
      year,
      monthlyBasicDeduction: 5000,
      brackets: [{ threshold: 0, rate: 0.03, quickDeduction: 0 }],
      sihfRates: { pension: 0.08 },
      sihfBase: { min: 5000, max: 30000 },
      specialDeductions: { children: 1000 },
    };
    const rec = await prisma.config.create({
      data: {
        key,
        value: JSON.stringify(data),
        effectiveFrom: new Date(`${year}-01-01`),
      },
    });
    console.log("CREATED:", { id: rec.id, key });
  } catch (e) {
    console.error("ERROR:", e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
