export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;

// Routes racine existantes + slugs prévus (pricing, billing, compare, u, etc.)
// + termes de marque/sécurité. Sert à empêcher des conflits avec /[slug]
// futurs et à protéger l'identité loopstat.
const RESERVED_USERNAMES = new Set([
  "about",
  "admin",
  "album",
  "api",
  "artist",
  "auth",
  "billing",
  "compare",
  "contact",
  "dashboard",
  "explore",
  "favicon",
  "help",
  "import",
  "legal",
  "listening-clock",
  "login",
  "logout",
  "loopstat",
  "manifest",
  "og",
  "pricing",
  "privacy",
  "robots",
  "root",
  "settings",
  "share",
  "sitemap",
  "support",
  "system",
  "terms",
  "top",
  "track",
  "u",
]);

const FORMAT_REGEX = /^[a-z][a-z0-9_-]{2,19}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export type UsernameValidation =
  | { ok: true; value: string }
  | { ok: false; error: string };

export function validateUsername(raw: string): UsernameValidation {
  const value = normalizeUsername(raw);

  if (value.length === 0) {
    return { ok: false, error: "Le pseudo est requis." };
  }
  if (value.length < USERNAME_MIN_LENGTH) {
    return {
      ok: false,
      error: `Au moins ${USERNAME_MIN_LENGTH} caractères.`,
    };
  }
  if (value.length > USERNAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `${USERNAME_MAX_LENGTH} caractères maximum.`,
    };
  }
  if (!FORMAT_REGEX.test(value)) {
    return {
      ok: false,
      error:
        "Commence par une lettre, puis lettres, chiffres, tirets ou underscores uniquement.",
    };
  }
  if (RESERVED_USERNAMES.has(value)) {
    return { ok: false, error: "Ce pseudo est réservé." };
  }

  return { ok: true, value };
}
