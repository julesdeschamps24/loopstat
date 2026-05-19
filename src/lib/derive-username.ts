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
 * Dérive un username à partir du displayName (fallback : uniqueId).
 * Garantit le format attendu par {@link validateUsername} : commence par une
 * lettre, 3-20 caractères, [a-z0-9_-]. Ne gère pas l'unicité ni les mots
 * réservés — c'est le job de l'appelant (server action).
 */
export function deriveUsername(
  displayName: string | null | undefined,
  uniqueId: string,
): string {
  const source = displayName?.trim() || uniqueId;

  let slug = slugify(source);
  slug = ensureLetterPrefix(slug);

  if (slug.length < USERNAME_MIN_LENGTH) {
    const padded = ensureLetterPrefix(slug + slugify(uniqueId));
    slug = padded.length >= USERNAME_MIN_LENGTH ? padded : "user";
  }

  return slug.slice(0, USERNAME_MAX_LENGTH);
}

/**
 * Ajoute un suffixe court issu de uniqueId pour résoudre une collision.
 * L'identifiant étant unique par compte, cette opération garantit (sauf
 * cas pathologique) l'unicité du résultat.
 */
export function withUniqueSuffix(base: string, uniqueId: string): string {
  const suffix = `-${slugify(uniqueId.slice(-6)) || "x"}`;
  const room = USERNAME_MAX_LENGTH - suffix.length;
  const head = base.slice(0, room).replace(/-+$/, "");
  return head + suffix;
}
