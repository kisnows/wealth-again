import prisma from "@/server/db";

export async function computeAccountSummary(
  displayCurrency?: string,
  userId?: string,
) {
  const accounts = await prisma.account.findMany({
    where: userId ? { userId } : undefined,
    include: {
      valuations: { orderBy: { asOf: "desc" }, take: 1 },
      txnLines: true,
    },
  });
  const latestFx = await prisma.fxRate.findMany({ orderBy: { asOf: "desc" } });
  const getRate = (quote: string) =>
    latestFx.find((r) => r.base === "USD" && r.quote === quote)
      ?.rate as unknown as number | undefined;
  const usdToDisplay = displayCurrency ? getRate(displayCurrency) : undefined;

  return accounts.map((a) => {
    const latestSnapshot = a.valuations[0];
    const initialBalance = Number(a.initialBalance);
    const principal = a.txnLines.reduce(
      (s, l) => s + Number(l.amount),
      initialBalance,
    );
    const valuation =
      a.accountType === "SAVINGS"
        ? principal
        : Number(latestSnapshot?.totalValue ?? principal);
    const profit = valuation - principal;
    const roi = principal === 0 ? null : profit / principal;
    // 折算到展示币种
    let displayVal = valuation;
    if (displayCurrency && displayCurrency !== a.baseCurrency) {
      const usdToAcc = getRate(a.baseCurrency);
      if (usdToAcc && usdToDisplay) {
        const inUsd = valuation / usdToAcc;
        displayVal = inUsd * usdToDisplay;
      }
    }
    return {
      id: a.id,
      name: a.name,
      accountType: a.accountType,
      status: a.status,
      subType: a.subType,
      description: a.description,
      currency: a.baseCurrency,
      initialBalance,
      principal,
      valuation,
      profit,
      roi,
      latestValuationAt:
        a.accountType === "SAVINGS"
          ? null
          : (latestSnapshot?.asOf.toISOString() ?? null),
      valuationCurrency: latestSnapshot?.currency ?? a.baseCurrency,
      displayValue: displayVal,
    };
  });
}
