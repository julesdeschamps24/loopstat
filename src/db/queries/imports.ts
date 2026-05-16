import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { imports } from "@/db/schema";

/**
 * True si l'utilisateur a au moins un import dont le statut est
 * "completed". Utilisé pour décider d'afficher la grosse bannière
 * d'import (false) ou le petit lien discret (true).
 *
 * Pattern "exists" : on récupère 1 colonne + LIMIT 1, plus efficace
 * qu'un COUNT(*) sur potentiellement plusieurs imports.
 */
export async function hasCompletedImport(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: imports.id })
    .from(imports)
    .where(and(eq(imports.userId, userId), eq(imports.status, "completed")))
    .limit(1);
  return row !== undefined;
}
