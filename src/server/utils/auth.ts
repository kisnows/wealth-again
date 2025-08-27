import { auth } from "@/server/auth";
import { NextRequest } from "next/server";

export async function getUserFromRequest(req: NextRequest) {
  const session = await auth();
  return session?.user ?? null;
}
