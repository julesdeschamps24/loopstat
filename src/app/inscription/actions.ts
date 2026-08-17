"use server";

import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { signIn } from "@/auth";
import { hashPassword } from "@/lib/auth/password";
import { validateCredentials } from "@/lib/auth/validate";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate-limit";

export type SignUpState = { error: string } | null;

// 5 créations de compte / heure par IP — large pour un humain, bloquant
// pour un script.
const SIGNUP_MAX_PER_IP = 5;
const SIGNUP_WINDOW_MS = 60 * 60 * 1000;

export async function signUpAction(
  _prev: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  const ip = clientIpFromHeaders(await headers());
  const rl = checkRateLimit(`signup:${ip}`, SIGNUP_MAX_PER_IP, SIGNUP_WINDOW_MS);
  if (!rl.ok) {
    return { error: "Trop de tentatives. Réessaie dans quelques minutes." };
  }

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const v = validateCredentials(email, password);
  if (!v.ok) return { error: v.error };

  const existing = await db.query.users.findFirst({
    where: eq(users.email, v.email),
  });
  if (existing) {
    return { error: "Un compte existe déjà avec cet email. Connecte-toi." };
  }

  const passwordHash = await hashPassword(password);
  try {
    await db.insert(users).values({ email: v.email, passwordHash });
  } catch {
    return { error: "Un compte existe déjà avec cet email. Connecte-toi." };
  }

  // signIn throws a NEXT_REDIRECT on success — must NOT be caught.
  await signIn("credentials", { email: v.email, password, redirectTo: "/dashboard" });
  return null;
}
