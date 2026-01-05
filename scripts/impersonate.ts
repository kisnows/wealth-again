import db from "../src/server/db";
import { users } from "../src/server/db/schema";
import { eq } from "drizzle-orm";

const userId = process.argv[2];
if (!userId) {
  console.error("usage: tsx scripts/impersonate.ts <userId>");
  process.exit(1);
}

const [updated] = await db
  .update(users)
  .set({ isActive: true })
  .where(eq(users.id, userId))
  .returning();

if (!updated) {
  console.error("user not found");
  process.exit(1);
}

console.log("updated", updated.id);
