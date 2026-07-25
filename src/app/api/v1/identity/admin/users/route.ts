import { type NextRequest, NextResponse } from "next/server";
import db from "@/server/db";
import { cities, users as usersTable } from "@/server/db/schema";
import { getUserFromRequest } from "@/server/utils/auth";
import { asc, eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || typeof user.id !== "string") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const users = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      displayCurrency: usersTable.displayCurrency,
      currentCityId: usersTable.currentCityId,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
      currentCityName: cities.name,
      currentCityCountry: cities.country,
    })
    .from(usersTable)
    .leftJoin(cities, eq(cities.id, usersTable.currentCityId))
    .orderBy(asc(usersTable.createdAt));

  return NextResponse.json({
    items: users.map((item) => ({
      id: item.id,
      email: item.email,
      name: item.name,
      displayCurrency: item.displayCurrency,
      currentCityId: item.currentCityId,
      isActive: item.isActive,
      currentCity: item.currentCityId
        ? {
            name: item.currentCityName,
            country: item.currentCityCountry,
          }
        : null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
  });
}
