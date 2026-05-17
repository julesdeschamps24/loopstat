"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { ensureUsernamePersisted, setIsPublic } from "@/db/queries/users";

export type ProfileFormState =
  | { status: "idle" }
  | { status: "ok"; message: string; username: string }
  | { status: "error"; error: string };

export async function updateProfileAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { status: "error", error: "Tu dois être connecté." };
  }

  const isPublic = formData.get("isPublic") === "on";

  const userRow = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { displayName: true, spotifyId: true },
  });
  if (!userRow) {
    return { status: "error", error: "Compte introuvable." };
  }

  const ensured = await ensureUsernamePersisted(
    session.user.id,
    userRow.displayName,
    userRow.spotifyId,
  );
  if (!ensured.ok) {
    return {
      status: "error",
      error:
        "Impossible de réserver ton pseudo (collision). Réessaie ou contacte-nous.",
    };
  }

  await setIsPublic(session.user.id, isPublic);

  revalidatePath("/settings");
  revalidatePath(`/u/${ensured.username}`);
  return {
    status: "ok",
    message: isPublic
      ? "Profil public activé."
      : "Profil mis à jour (privé).",
    username: ensured.username,
  };
}
