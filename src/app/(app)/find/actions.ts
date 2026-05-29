"use server";

import { auth } from "@/auth";
import {
  searchPublicProfiles,
  type PublicProfileSummary,
} from "@/db/queries/users";

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 30;
const MAX_RESULTS = 20;

export type SearchResult =
  | { ok: true; results: PublicProfileSummary[] }
  | { ok: false; error: "unauthenticated" | "invalid_query" };

export async function searchUsersAction(
  query: string,
): Promise<SearchResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthenticated" };

  const q = query.trim().toLowerCase();
  if (q.length < MIN_QUERY_LENGTH || q.length > MAX_QUERY_LENGTH) {
    return { ok: false, error: "invalid_query" };
  }

  const results = await searchPublicProfiles(q, MAX_RESULTS);
  return { ok: true, results };
}
