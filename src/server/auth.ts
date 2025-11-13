import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createFieldAttribute } from "better-auth/db";
import { nextCookies, toNextJsHandler } from "better-auth/next-js";
import prisma from "@/server/db";
import { hashPassword, verifyPassword } from "@/server/services/identity/password";

type PrismaProvider =
  | "sqlite"
  | "postgresql"
  | "mysql"
  | "cockroachdb"
  | "sqlserver"
  | "mongodb";

function isValidProvider(value?: string): value is PrismaProvider {
  return (
    value === "sqlite" ||
    value === "postgresql" ||
    value === "mysql" ||
    value === "cockroachdb" ||
    value === "sqlserver" ||
    value === "mongodb"
  );
}

function inferPrismaProvider(): PrismaProvider {
  const fromEnv = process.env.DATABASE_PROVIDER;
  if (isValidProvider(fromEnv)) return fromEnv;
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("file:")) return "sqlite";
  if (url.startsWith("postgres")) return "postgresql";
  if (url.startsWith("mysql")) return "mysql";
  if (url.startsWith("cockroach")) return "cockroachdb";
  if (url.startsWith("sqlserver")) return "sqlserver";
  if (url.startsWith("mongodb")) return "mongodb";
  return "sqlite";
}

export const auth = betterAuth({
  appName: "Wealth Again",
  plugins: [nextCookies()],
  database: prismaAdapter(prisma, { provider: inferPrismaProvider() }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 72,
    autoSignIn: false,
    password: {
      hash: async (password) => hashPassword(password),
      verify: async ({ hash, password }) => verifyPassword(password, hash),
    },
  },
  user: {
    additionalFields: {
      currentCityId: createFieldAttribute("string", {
        required: true,
        references: {
          model: "city",
          field: "id",
          onDelete: "restrict",
        },
      }),
      displayCurrency: createFieldAttribute("string", {
        required: false,
      }),
      isActive: createFieldAttribute("boolean", {
        required: false,
        defaultValue: true,
      }),
    },
  },
  session: {
    modelName: "authSession",
  },
  account: {
    modelName: "authAccount",
  },
  verification: {
    modelName: "authVerification",
  },
});

const handlers = toNextJsHandler(auth);

export const { GET, POST } = handlers;
