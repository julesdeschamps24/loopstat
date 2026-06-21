export const MIN_PASSWORD_LENGTH = 8;

export type ValidationResult =
  | { ok: true; email: string }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate sign-up / sign-in credentials. Trims + lowercases the email on
 * success. Caller treats `ok: false` as a generic failure (don't leak which
 * field was wrong to the end user where it matters).
 */
export function validateCredentials(
  email: string,
  password: string,
): ValidationResult {
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_RE.test(normalized)) {
    return { ok: false, error: "Adresse email invalide." };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`,
    };
  }
  return { ok: true, email: normalized };
}
