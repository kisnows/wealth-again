import Link from "next/link";

export default function Home() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Wealth Again</h1>
      <nav>
        <ul className="list-disc pl-6 space-y-1">
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
        </ul>
      </nav>
    </main>
  );
}
