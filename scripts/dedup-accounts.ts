import { prisma } from "../src/lib/prisma";

async function main() {
  const accounts = await prisma.account.findMany({
    orderBy: { createdAt: "asc" },
  });
  const keepIds = new Set<string>();
  const toDelete: string[] = [];
  const seen = new Map<string, string>();
  for (const a of accounts) {
    const key = `${a.userId}::${a.name}`;
    if (!seen.has(key)) {
      seen.set(key, a.id);
      keepIds.add(a.id);
    } else {
      toDelete.push(a.id);
    }
  }
  if (toDelete.length > 0) {
    await prisma.transaction.deleteMany({
      where: { accountId: { in: toDelete } },
    });
    await prisma.valuationSnapshot.deleteMany({
      where: { accountId: { in: toDelete } },
    });
    await prisma.lot.deleteMany({ where: { accountId: { in: toDelete } } });
    await prisma.account.deleteMany({ where: { id: { in: toDelete } } });
    console.log("Deleted duplicate accounts:", toDelete.length);
  } else {
    console.log("No duplicate accounts found.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
