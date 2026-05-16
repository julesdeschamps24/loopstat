"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

import { cn, formatNumber } from "@/lib/utils";

type Result = {
  trackId: string;
  name: string;
  albumImageUrl: string | null;
  artistNames: string[];
  plays: number;
};

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "results"; items: Result[] }
  | { kind: "error" };

const DEBOUNCE_MS = 300;
const MIN_QUERY_LEN = 2;

/**
 * Sidebar track search. Local catalog only (tracks the user has actually
 * streamed). Debounced (300 ms), dropdown of up to 10 results, Esc /
 * click-outside to close.
 */
export function SearchBar() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ kind: "idle" });

  const trimmed = query.trim();
  const tooShort = trimmed.length < MIN_QUERY_LEN;
  // Display "idle" whenever the query is below threshold, regardless of
  // any stale fetched state. Derived rather than set in an effect to avoid
  // a cascading render.
  const displayState: State = tooShort ? { kind: "idle" } : state;

  // Debounced fetch on query change. setState calls happen inside the
  // setTimeout / fetch callbacks (not the effect body), so the lint rule
  // about cascading renders is satisfied.
  useEffect(() => {
    if (tooShort) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setState({ kind: "loading" });
      void (async () => {
        try {
          const res = await fetch(
            `/api/search/tracks?q=${encodeURIComponent(trimmed)}`,
            { signal: controller.signal },
          );
          if (!res.ok) {
            setState({ kind: "error" });
            return;
          }
          const body = (await res.json()) as { results?: Result[] };
          const items = body.results ?? [];
          setState(items.length === 0 ? { kind: "empty" } : { kind: "results", items });
        } catch (err) {
          if ((err as { name?: string }).name === "AbortError") return;
          setState({ kind: "error" });
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, tooShort]);

  // Click-outside to close.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setQuery("");
      setOpen(false);
      inputRef.current?.blur();
    }
    if (e.key === "Enter" && displayState.kind === "results" && displayState.items[0]) {
      e.preventDefault();
      selectResult(displayState.items[0].trackId);
    }
  }

  function selectResult(trackId: string) {
    setQuery("");
    setOpen(false);
    router.push(`/track/${trackId}`);
  }

  const showDropdown = open && query.trim().length >= MIN_QUERY_LEN;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder="Rechercher un titre…"
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="w-full rounded-lg border border-white/10 bg-white/5 py-1.5 pl-8 pr-7 text-sm placeholder:text-muted-foreground focus:border-[#7c3aed] focus:outline-none"
        />
        {query.length > 0 ? (
          <button
            type="button"
            aria-label="Effacer"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        ) : null}
      </div>

      {showDropdown ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-y-auto rounded-lg border border-white/10 bg-[#0a0a14]/95 backdrop-blur-xl shadow-xl">
          {displayState.kind === "loading" ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">
              Recherche…
            </p>
          ) : null}
          {displayState.kind === "empty" ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">
              Aucun titre trouvé dans ton historique.
            </p>
          ) : null}
          {displayState.kind === "error" ? (
            <p className="px-3 py-3 text-xs text-red-400">Erreur de recherche.</p>
          ) : null}
          {displayState.kind === "results" ? (
            <ul className="py-1">
              {displayState.items.map((r) => (
                <li key={r.trackId}>
                  <Link
                    href={`/track/${r.trackId}`}
                    onClick={() => selectResult(r.trackId)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 text-sm transition",
                      "hover:bg-white/10",
                    )}
                  >
                    {r.albumImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.albumImageUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="size-8 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <div className="size-8 shrink-0 rounded-md bg-muted" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{r.name}</p>
                      {r.artistNames.length > 0 ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {r.artistNames.join(", ")}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {formatNumber(r.plays)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
