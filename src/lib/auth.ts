// 最小占位以满足现有测试：不引入 next-auth 依赖
export const authOptions = {
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET || "dev-secret",
  pages: { signIn: "/login" },
};

