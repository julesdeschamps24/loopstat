import { cache } from "react";
import { and, asc, eq, ilike, isNotNull, or } from "drizzle-orm";

import { db } from "@/db/client";
import { users } from "@/db/schema";
import { deriveUsername, withUniqueSuffix } from "@/lib/derive-username";

export type ProfileRow = {
  username: string | null;
  isPublic: boolean;
  displayName: string | null;
  spotifyId: string;
};

export const getProfile = cache(
  async (userId: string): Promise<ProfileRow | null> => {
    const row = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        username: true,
        isPublic: true,
        displayName: true,
        spotifyId: true,
      },
    });
    return row ?? null;
  },
);

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "23505"
  );
}

/**
 * Idempotent : si l'utilisateur a déjà un username persisté, on le retourne
 * tel quel. Sinon on dérive depuis displayName/spotifyId et on l'écrit en DB,
 * en résolvant une éventuelle collision avec un suffix issu du spotifyId.
 */
export async function ensureUsernamePersisted(
  userId: string,
  displayName: string | null,
  spotifyId: string,
): Promise<{ ok: true; username: string } | { ok: false }> {
  const existing = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { username: true },
  });
  if (existing?.username) return { ok: true, username: existing.username };

  const base = deriveUsername(displayName, spotifyId);
  const candidates = [base, withUniqueSuffix(base, spotifyId)];

  for (const candidate of candidates) {
    try {
      await db.update(users).set({ username: candidate }).where(eq(users.id, userId));
      return { ok: true, username: candidate };
    } catch (err) {
      if (!isUniqueViolation(err)) return { ok: false };
      // Sinon on retente avec le candidat suivant
    }
  }
  return { ok: false };
}

export async function setIsPublic(
  userId: string,
  isPublic: boolean,
): Promise<void> {
  await db.update(users).set({ isPublic }).where(eq(users.id, userId));
}

export type PublicProfile = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

/**
 * Lookup d'un user par son username. Retourne null si pas trouvé OU si le
 * profil n'est pas public — l'appelant n'a pas à distinguer les deux (404
 * uniforme pour ne pas leaker l'existence d'un compte privé).
 */
export const getPublicProfileByUsername = cache(
  async (username: string): Promise<PublicProfile | null> => {
    const normalized = username.trim().toLowerCase();
    if (!normalized) return null;

    const row = await db.query.users.findFirst({
      where: eq(users.username, normalized),
      columns: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        isPublic: true,
      },
    });
    if (!row || !row.isPublic || !row.username) return null;

    return {
      id: row.id,
      username: row.username,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
    };
  },
);

export type PublicProfileSummary = {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

/**
 * Escape Postgres LIKE wildcards (% and _) and the escape char itself
 * so user input is treated as literal text. Without this, typing "_"
 * or "%" would match anything.
 */
export function escapeLikePattern(raw: string): string {
  return raw.replace(/[\\%_]/g, "\\$&");
}

/**
 * Search public profiles by username OR displayName, case-insensitive.
 * Returns up to `limit` rows ordered by username.
 *
 * Caller MUST pre-trim/lowercase the query and enforce min length.
 * `is_public=true` is enforced server-side so private accounts are
 * never enumerated.
 */
export async function searchPublicProfiles(
  query: string,
  limit: number,
): Promise<PublicProfileSummary[]> {
  const pattern = `%${escapeLikePattern(query)}%`;
  const rows = await db
    .select({
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(
      and(
        eq(users.isPublic, true),
        isNotNull(users.username),
        // No explicit isNotNull on display_name: `NULL ILIKE ...` is
        // NULL (falsy) in Postgres, so the username arm of the OR
        // carries those rows safely.
        or(ilike(users.username, pattern), ilike(users.displayName, pattern)),
      ),
    )
    .orderBy(asc(users.username))
    .limit(limit);
  return rows.filter((r): r is PublicProfileSummary => r.username !== null);
}
