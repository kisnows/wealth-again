import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const userId = process.argv[2]
if (!userId) {
  console.error('usage: node scripts/impersonate.js <userId>')
  process.exit(1)
}
const res = await prisma.user.update({
  where: { id: userId },
  data: { isActive: true },
})
console.log('updated', res.id)
process.exit(0)
