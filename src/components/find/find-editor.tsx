"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";

import { searchUsersAction } from "@/app/find/actions";
import { ResultCard } from "@/components/find/result-card";
import type { PublicProfileSummary } from "@/db/queries/users";

const MIN_QUERY = 2;
const DEBOUNCE_MS = 250;
const MAX_INPUT = 30;

export function FindEditor() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicProfileSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Search debounce is genuine external sync via setTimeout (the effect
  // sets up a real subscription; setState happens when the timer fires).
  // The early-return synchronous resets and the leading isLoading=true
  // are control state for the same subscription — disable the rule for
  // the relevant lines rather than peppering each call.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY) {
      setResults([]);
      setHasSearched(false);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    const handle = setTimeout(async () => {
      const result = await searchUsersAction(trimmed);
      if (cancelled) return;
      setResults(result.ok ? result.results : []);
      setHasSearched(true);
      setIsLoading(false);
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  const trimmed = query.trim();

  return (
    <div className="flex flex-col gap-8">
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          placeholder="Pseudo ou nom…"
          maxLength={MAX_INPUT}
          className="w-full rounded-2xl border bg-card py-3 pl-12 pr-4 text-base outline-none focus:border-[#7c3aed]/60 focus:ring-2 focus:ring-[#7c3aed]/20"
        />
      </div>

      {trimmed.length < MIN_QUERY ? (
        <p className="text-sm text-muted-foreground">
          Tape un pseudo (min {MIN_QUERY} caractères) pour rechercher.
        </p>
      ) : isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 rounded-2xl border bg-card/40 animate-pulse"
            />
          ))}
        </div>
      ) : hasSearched && results.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun profil trouvé pour «&nbsp;{trimmed}&nbsp;». Vérifie
          l&apos;orthographe ou demande son pseudo à ton pote.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {results.map((r) => (
            <ResultCard key={r.username} result={r} />
          ))}
        </div>
      )}
    </div>
  );
}
