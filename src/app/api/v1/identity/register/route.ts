import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  CityNotFoundError,
  DisplayCurrencyNotSupportedError,
  UserEmailConflictError,
  registerUser,
  type RegisterUserInput,
} from "@/server/services/identity/register";
import {
  ensureIdempotent,
  markIdempotencyUsed,
} from "@/server/utils/idempotency";

export async function POST(req: NextRequest) {
  let payload: RegisterUserInput;
  try {
    payload = (await req.json()) as RegisterUserInput;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const emailKey =
    typeof payload.email === "string"
      ? `register:${payload.email.toLowerCase()}`
      : undefined;

  const { key, existed } = await ensureIdempotent(req, undefined, emailKey);
  if (existed) {
    return NextResponse.json({ error: "Idempotency key reused" }, { status: 409 });
  }

  try {
    const user = await registerUser(payload);
    await markIdempotencyUsed(key);
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: error.issues },
        { status: 400 },
      );
    }
    if (error instanceof UserEmailConflictError) {
      return NextResponse.json({ error: "email_conflict" }, { status: 409 });
    }
    if (error instanceof CityNotFoundError) {
      return NextResponse.json({ error: "city_not_found" }, { status: 422 });
    }
    if (error instanceof DisplayCurrencyNotSupportedError) {
      return NextResponse.json(
        { error: "display_currency_not_supported" },
        { status: 422 },
      );
    }
    console.error("Register user error:", error);
    return NextResponse.json(
      { error: "internal_server_error" },
      { status: 500 },
    );
  }
}

