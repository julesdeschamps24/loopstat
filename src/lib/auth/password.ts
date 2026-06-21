import bcrypt from "bcryptjs";

const ROUNDS = 12;

/** bcrypt hash of a plaintext password (salted, cost 12). */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

/** Constant-time-ish comparison of a plaintext password against a bcrypt hash. */
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
