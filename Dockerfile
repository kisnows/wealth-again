FROM node:20-alpine AS base
WORKDIR /app

# 复制包管理文件
COPY package.json pnpm-lock.yaml ./

# 安装 pnpm 并安装依赖
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 生成 Prisma 客户端并构建
RUN npx prisma generate && pnpm build

EXPOSE 4000
CMD ["pnpm", "start"]
