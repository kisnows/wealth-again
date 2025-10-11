import { redirect } from "next/navigation";

export default function IncomeRecalcRedirectPage() {
  redirect("/income?dialog=recalc");
}
