import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";
import { getUserFromRequest } from "@/server/utils/auth";

/**
 * PATCH /api/v1/accounts/:id
 * - 仅允许更新: name, subType, description, status
 * - 禁止: baseCurrency 修改
 * - 入参: { name?: string, subType?: string, description?: string, status?: "ACTIVE"|"ARCHIVED" }
 * - 返回: 501 TODO（占位），后续返回更新后的 Account
 */

// PATCH /api/v1/accounts/:id 仅允许 name/subType/description/status（禁止修改 baseCurrency）
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const account = await prisma.account.findUnique({ where: { id: params.id } });
  if (!account || account.userId !== (user as any).id) return NextResponse.json({ error: "Not Found" }, { status: 404 });
  const allowed: any = {};
  for (const k of ["name", "subType", "description", "status"]) {
    if (k in body) allowed[k] = body[k];
  }
  if ("baseCurrency" in body) {
    return NextResponse.json({ error: "baseCurrency is immutable" }, { status: 400 });
  }
  const updated = await prisma.account.update({ where: { id: params.id }, data: allowed });
  return NextResponse.json(updated);
}
