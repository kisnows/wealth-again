const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function createTestUser() {
  const prisma = new PrismaClient();
  
  try {
    // 检查是否已有用户
    const existingUser = await prisma.user.findFirst();
    if (existingUser) {
      console.log('User already exists:', existingUser.email, 'ID:', existingUser.id);
      return;
    }

    // 创建测试用户
    const hashedPassword = await bcrypt.hash('demo123', 10);
    const user = await prisma.user.create({
      data: {
        email: 'demo@example.com',
        password: hashedPassword,
        name: 'Demo User',
        baseCurrency: 'CNY',
      },
    });
    
    console.log('Created test user:', user.email, 'ID:', user.id);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();