import { compare, genSalt, hash } from "bcryptjs";

const DEFAULT_SALT_ROUNDS = 12;

export async function hashPassword(
  plain: string,
  rounds = DEFAULT_SALT_ROUNDS,
): Promise<string> {
  if (plain.length === 0) {
    throw new Error("password_empty");
  }
  const salt = await genSalt(rounds);
  return hash(plain, salt);
}

export async function verifyPassword(
  plain: string,
  hashed: string,
): Promise<boolean> {
  if (!plain || !hashed) return false;
  try {
    return compare(plain, hashed);
  } catch {
    return false;
  }
}

