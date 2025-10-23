import { NextResponse, type NextRequest } from "next/server";
import { buildIncomeTimeline } from "@/server/services/income-timeline";
import { getUserFromRequest } from "@/server/utils/auth";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const displayCurrency = searchParams.get("displayCurrency");

  if (!from || !to) {
    return NextResponse.json(
      { error: "from and to are required" },
      { status: 400 },
    );
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await buildIncomeTimeline(
      user.id,
      from,
      to,
      displayCurrency ?? undefined,
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("income timeline error", error);
    return NextResponse.json(
      { error: "failed_to_build_income_timeline" },
      { status: 500 },
    );
  }
}
