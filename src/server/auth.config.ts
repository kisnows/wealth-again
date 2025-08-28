import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import prisma from "@/server/db";

export default {
  providers: [
    Credentials({
      name: "Credentials",
      credentials: { email: {}, password: {} },
      authorize: async (creds) => {
        const email = String(creds?.email || "").toLowerCase();
        const password = String(creds?.password || "");
        const user = await prisma.user.findUnique({ where: { email } });
        // DEMO: 仅用于开发演示。真实项目请使用安全的密码校验(Bcrypt)与锁定策略。
        if (user && password) {
          return { id: user.id, email: user.email, name: user.name } as any;
        }
        return null;
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.sub = String(user.id);
      return token;
    },
    async session({ session, token }) {
      if (session.user && token?.sub) (session.user as any).id = token.sub;
      return session;
    },
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;
