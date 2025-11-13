import { z } from "zod";
import { APIError } from "better-auth/api";
import prisma from "@/server/db";
import { auth } from "@/server/auth";
import { logAudit } from "@/server/services/audit";
import { DISPLAY_CURRENCY_SET } from "@/server/services/identity/constants";

export class UserEmailConflictError extends Error {
  constructor(email: string) {
    super(`user_email_conflict:${email}`);
    this.name = "UserEmailConflictError";
  }
}

export class CityNotFoundError extends Error {
  constructor(cityId: string) {
    super(`city_not_found:${cityId}`);
    this.name = "CityNotFoundError";
  }
}

export class DisplayCurrencyNotSupportedError extends Error {
  constructor(currency: string) {
    super(`display_currency_not_supported:${currency}`);
    this.name = "DisplayCurrencyNotSupportedError";
  }
}

export const registerUserSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "email_required")
    .email("email_invalid")
    .transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(8, "password_too_short")
    .max(72, "password_too_long"),
  name: z
    .string()
    .trim()
    .max(120, "name_too_long")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  cityId: z.string().min(1, "city_required"),
  displayCurrency: z
    .string()
    .trim()
    .min(1, "display_currency_invalid")
    .max(10, "display_currency_invalid")
    .optional()
    .transform((value) => (value && value.length > 0 ? value.toUpperCase() : undefined)),
});

export type RegisterUserInput = z.infer<typeof registerUserSchema>;

type RegisterUserResult = {
  id: string;
  email: string;
  name: string | null;
  currentCityId: string;
  displayCurrency: string | null;
};

export async function registerUser(
  input: RegisterUserInput,
): Promise<RegisterUserResult> {
  const parsed = registerUserSchema.parse(input);

  const displayCurrency =
    parsed.displayCurrency && parsed.displayCurrency.length > 0
      ? parsed.displayCurrency.toUpperCase()
      : null;
  if (displayCurrency && !DISPLAY_CURRENCY_SET.has(displayCurrency)) {
    throw new DisplayCurrencyNotSupportedError(displayCurrency);
  }

  const city = await prisma.city.findUnique({
    where: { id: parsed.cityId },
    select: { id: true },
  });
  if (!city) {
    throw new CityNotFoundError(parsed.cityId);
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.email },
    select: { id: true },
  });
  if (existing) {
    throw new UserEmailConflictError(parsed.email);
  }

  const name = parsed.name?.trim() || parsed.email;

  try {
    const created = await auth.api.signUpEmail({
      body: {
        name,
        email: parsed.email,
        password: parsed.password,
        currentCityId: city.id,
        displayCurrency,
      },
    });

    await logAudit("USER_REGISTER", {
      userId: created.user.id,
      meta: {
        email: created.user.email,
        currentCityId: created.user.currentCityId,
        displayCurrency: created.user.displayCurrency,
        method: "credentials",
      },
    });

    return {
      id: created.user.id,
      email: created.user.email,
      name: created.user.name ?? null,
      currentCityId: created.user.currentCityId,
      displayCurrency: created.user.displayCurrency,
    } satisfies RegisterUserResult;
  } catch (error) {
    if (error instanceof APIError) {
      if (error.message === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
        throw new UserEmailConflictError(parsed.email);
      }
    }
    throw error;
  }
}
