import prisma from "@/server/db";
import {
  computeAccountSummaryById,
  type AccountSummaryItem,
} from "@/server/services/accounts-summary";

export async function getAccountSummary(id: string) {
  const summary = await computeAccountSummaryById({ accountId: id });
  return summary as AccountSummaryItem | null;
}

export async function postDeposit(input: {
  accountId: string;
  amount: number;
  occurredAt: string;
  note?: string;
}) {
  const account = await prisma.account.findUnique({
    where: { id: input.accountId },
  });
  if (!account) throw new Error("Account not found");
  return prisma.txnEntry.create({
    data: {
      userId: account.userId,
      type: "DEPOSIT",
      occurredAt: new Date(input.occurredAt),
      note: input.note,
      lines: {
        create: {
          accountId: input.accountId,
          amount: input.amount,
          currency: account.baseCurrency,
          note: input.note,
        },
      },
    },
    include: { lines: true },
  });
}

export async function postTransfer(input: {
  from: { accountId: string; amount: number };
  to: { accountId: string; amount?: number };
  occurredAt: string;
  note?: string;
  asOf?: string;
}) {
  const fromAccount = await prisma.account.findUnique({
    where: { id: input.from.accountId },
  });
  const toAccount = await prisma.account.findUnique({
    where: { id: input.to.accountId },
  });
  if (!fromAccount || !toAccount) throw new Error("Account not found");
  // 允许跨币种：若未指定目标金额，调用 FxService.convert 折算（略）
  return prisma.txnEntry.create({
    data: {
      userId: fromAccount.userId,
      type: "TRANSFER",
      occurredAt: new Date(input.occurredAt),
      note: input.note,
      lines: {
        create: [
          {
            accountId: input.from.accountId,
            amount: -Math.abs(input.from.amount),
            currency: fromAccount.baseCurrency,
            note: input.note,
          },
          {
            accountId: input.to.accountId,
            amount: Math.abs(input.to.amount ?? input.from.amount),
            currency: toAccount.baseCurrency,
            note: input.note,
          },
        ],
      },
    },
    include: { lines: true },
  });
}
