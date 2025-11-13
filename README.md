This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Prisma 与环境变量（新增）

本项目使用 Prisma 管理数据库模型与客户端，开发环境默认使用本地 SQLite。

1. 初始化与迁移

```bash
# 生成 Prisma 客户端
npx prisma generate

# 应用/创建本地开发迁移（会更新 prisma/dev.db）
npx prisma migrate dev
```

2. `.env` 示例（请勿提交到仓库）

```env
# 本地 SQLite 示例
DATABASE_URL="file:./prisma/dev.db"

# 如使用 better-auth，可配置：
# BETTER_AUTH_SECRET=your-secret
```

3. 运行测试

已添加 Vitest 脚本，可执行：

```bash
npm test
```

首次运行前请安装依赖（包含 Vitest）：

```bash
npm install
```

- 测试账号： demo@example.com
- 测试密码： demo
