import { prisma } from "@/lib/prisma";
import AccountDetail from "@/components/investment/account-detail";

export default async function AccountDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const account = await prisma.account.findUnique({ where: { id: params.id } });
  if (!account) return <div className="py-8">账户不存在</div>;

  return (
    <div className="space-y-6 py-6">
      <h1 className="text-2xl font-bold">账户详情：{account.name}</h1>
      <AccountDetail accountId={account.id} baseCurrency={account.baseCurrency} />
    </div>
  );
}


