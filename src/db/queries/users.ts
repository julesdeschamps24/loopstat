import { cache } from "react";
import { eq } from "drizzle-orm";

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
