import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import prisma from "@/server/db";
import { verifyPassword } from "@/server/services/identity/password";

export default {
  providers: [
    Credentials({
      name: "Credentials",
      credentials: { email: {}, password: {} },
      authorize: async (creds) => {
        const email = String(creds?.email || "").toLowerCase();
        const password = String(creds?.password || "");
        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, password: true },
        });
        if (user && user.password) {
          const passwordOk = await verifyPassword(password, user.password);
          if (!passwordOk) return null;
          return {
            id: user.id,
            email: user.email,
            name: user.name,
          };
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
      if (session.user && token?.sub) session.user.id = token.sub;
      return session;
    },
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;
