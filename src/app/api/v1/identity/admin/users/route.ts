import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";
import { getUserFromRequest } from "@/server/utils/auth";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || typeof user.id !== "string") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      displayCurrency: true,
      currentCityId: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      currentCity: {
        select: {
          name: true,
          country: true,
        },
      },
    },
  });

  return NextResponse.json({
    items: users.map((item) => ({
      id: item.id,
      email: item.email,
      name: item.name,
      displayCurrency: item.displayCurrency,
      currentCityId: item.currentCityId,
      isActive: item.isActive,
      currentCity: item.currentCity,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
  });
}
