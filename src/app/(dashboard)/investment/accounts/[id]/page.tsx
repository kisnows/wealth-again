import { prisma } from "@/lib/prisma";
import AccountOverview from "@/components/investment/account-overview";

type Params = Promise<{ id: string }>;

export default async function AccountDetailPage(props: {
  params: Params;
}) {
  const params = await props.params;
  const account = await prisma.account.findUnique({ where: { id: params.id } });
  if (!account) return <div className="py-8">账户不存在</div>;

  return (
    <div className="space-y-6 py-6">
      <h1 className="text-2xl font-bold">账户详情：{account.name}</h1>
      <AccountOverview accountId={account.id} baseCurrency={account.baseCurrency} />
    </div>
  );
}


