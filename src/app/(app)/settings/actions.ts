"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { ensureUsernamePersisted, setIsPublic } from "@/db/queries/users";
import { isAccent, isBackground } from "@/lib/profile/appearance";

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
    columns: { displayName: true },
  });
  if (!userRow) {
    return { status: "error", error: "Compte introuvable." };
  }

  const ensured = await ensureUsernamePersisted(
    session.user.id,
    userRow.displayName,
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

export type AppearanceFormState =
  | { status: "idle" }
  | { status: "ok"; message: string }
  | { status: "error"; error: string };

export async function updateAppearanceAction(
  _prev: AppearanceFormState,
  formData: FormData,
): Promise<AppearanceFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { status: "error", error: "Tu dois être connecté." };
  }

  const background = formData.get("background");
  const accent = formData.get("accent");
  if (!isBackground(background) || !isAccent(accent)) {
    return { status: "error", error: "Choix invalides." };
  }

  const row = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { profileSettings: true, username: true },
  });
  if (!row) return { status: "error", error: "Compte introuvable." };

  await db
    .update(users)
    .set({
      profileSettings: {
        ...(row.profileSettings ?? {}),
        background,
        accent,
      },
    })
    .where(eq(users.id, session.user.id));

  revalidatePath("/settings");
  if (row.username) revalidatePath(`/u/${row.username}`);

  return { status: "ok", message: "Apparence mise à jour." };
}
