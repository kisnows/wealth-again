import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createFieldAttribute } from "better-auth/db";
import { nextCookies, toNextJsHandler } from "better-auth/next-js";
import db from "@/server/db";
import * as schema from "@/server/db/schema";
import { hashPassword, verifyPassword } from "@/server/services/identity/password";

export const auth = betterAuth({
  appName: "Wealth Again",
  plugins: [nextCookies()],
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.users,
      session: schema.authSessions,
      account: schema.authAccounts,
      verification: schema.authVerifications,
    },
  }),
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
});

const handlers = toNextJsHandler(auth);

export const { GET, POST } = handlers;
