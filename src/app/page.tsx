import Link from "next/link";

export default function Home() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Wealth Again</h1>
      <nav>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <Link href="/dashboard" className="underline">
              Dashboard
            </Link>
          </li>
          <li>
            <Link href="/accounts" className="underline">
              Accounts
            </Link>
          </li>
          <li>
            <Link href="/accounts/new" className="underline">
              New Account
            </Link>
          </li>
          <li>
            <Link href="/entries/deposit" className="underline">
              Deposit
            </Link>
          </li>
          <li>
            <Link href="/entries/withdraw" className="underline">
              Withdraw
            </Link>
          </li>
          <li>
            <Link href="/entries/transfer" className="underline">
              Transfer
            </Link>
          </li>
          <li>
            <Link href="/income/records" className="underline">
              收入快照
            </Link>
          </li>
          <li>
            <Link href="/income/salary-changes" className="underline">
              工资变更
            </Link>
          </li>
          <li>
            <Link href="/income/bonus" className="underline">
              一次性奖金
            </Link>
          </li>
          <li>
            <Link href="/income/long-term-cash" className="underline">
              长期现金
            </Link>
          </li>
          <li>
            <Link href="/income/equity" className="underline">
              股权激励
            </Link>
          </li>
          <li>
            <Link href="/rules/cities" className="underline">
              规则-城市
            </Link>
          </li>
          <li>
            <Link href="/rules/social-security" className="underline">
              规则-社保
            </Link>
          </li>
          <li>
            <Link href="/rules/housing-fund" className="underline">
              规则-公积金
            </Link>
          </li>
          <li>
            <Link href="/rules/tax" className="underline">
              规则-税制
            </Link>
          </li>
          <li>
            <Link href="/settings" className="underline">
              设置
            </Link>
          </li>
        </ul>
      </nav>
    </main>
  );
}
