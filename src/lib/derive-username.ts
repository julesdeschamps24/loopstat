import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "./username";

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ensureLetterPrefix(slug: string): string {
  // Strip non-letter leading chars; if nothing left, prefix with "u".
  const trimmed = slug.replace(/^[^a-z]+/, "");
  if (trimmed.length === 0) return "u";
  return trimmed;
}

/**
 * Dérive un username à partir du displayName Spotify (fallback : spotifyId).
 * Garantit le format attendu par {@link validateUsername} : commence par une
 * lettre, 3-20 caractères, [a-z0-9_-]. Ne gère pas l'unicité ni les mots
 * réservés — c'est le job de l'appelant (server action).
 */
export function deriveUsername(
  displayName: string | null | undefined,
  spotifyId: string,
): string {
  const source = displayName?.trim() || spotifyId;

  let slug = slugify(source);
  slug = ensureLetterPrefix(slug);

  if (slug.length < USERNAME_MIN_LENGTH) {
    const padded = ensureLetterPrefix(slug + slugify(spotifyId));
    slug = padded.length >= USERNAME_MIN_LENGTH ? padded : "user";
  }

  return slug.slice(0, USERNAME_MAX_LENGTH);
}

/**
 * Ajoute un suffixe court issu de spotifyId pour résoudre une collision. Le
 * spotifyId étant unique par compte Spotify, cette opération garantit (sauf
 * cas pathologique) l'unicité du résultat.
 */
export function withUniqueSuffix(base: string, spotifyId: string): string {
  const suffix = `-${slugify(spotifyId.slice(-6)) || "x"}`;
  const room = USERNAME_MAX_LENGTH - suffix.length;
  const head = base.slice(0, room).replace(/-+$/, "");
  return head + suffix;
}
