"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Check, Download, Link as LinkIcon, Share2, Sparkles } from "lucide-react";
import type { ShareContext } from "@/lib/share/card-config";

type Props = {
  username: string;
  context?: ShareContext;
};

// Évite le setState-in-effect anti-pattern (React 19 strict) tout en
// laissant SSR retourner false : sur le serveur on rend rien de
// browser-dépendant, sur le client on bascule au mount sans re-render
// cascade.
function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function ShareButton({ username, context }: Props) {
  const isClient = useIsClient();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const origin = isClient ? window.location.origin : "https://loopstat.tech";
  const canNativeShare = isClient && "share" in navigator;

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const url = `${origin}/u/${username}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Permission denied / non-HTTPS context : laisse l'UX silencieuse
      // (l'utilisateur peut quand même copier depuis l'URL bar).
    }
  }

  async function nativeShare() {
    if (!("share" in navigator)) return;
    try {
      await navigator.share({
        title: "Mes stats Spotify sur loopstat",
        text: "Mes top titres, artistes et albums :",
        url,
      });
      setOpen(false);
    } catch {
      // L'utilisateur a annulé : on ne fait rien.
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-2 rounded-full bg-[#7c3aed] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#6d28d9]"
      >
        <Share2 className="size-4" />
        Partager
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-2 flex w-64 flex-col gap-0.5 rounded-xl border bg-popover p-1.5 shadow-xl"
        >
          <a
            href={`/share${context ? `?context=${context}` : ""}`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-lg bg-[#7c3aed]/10 px-3 py-2 text-left text-sm text-[#c4b5fd] transition hover:bg-[#7c3aed]/20"
          >
            <Sparkles className="size-4" />
            <span className="flex flex-col">
              <span className="font-medium">Personnaliser ma carte…</span>
              <span className="text-xs opacity-70">
                Choisis le format, la période, les items
              </span>
            </span>
          </a>
          <div className="my-1 border-t border-white/8" />
          <button
            type="button"
            role="menuitem"
            onClick={copyLink}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-accent"
          >
            {copied ? (
              <Check className="size-4 text-emerald-500" />
            ) : (
              <LinkIcon className="size-4" />
            )}
            <span className="flex flex-col">
              <span>{copied ? "Lien copié !" : "Copier le lien"}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {origin.replace(/^https?:\/\//, "")}/u/{username}
              </span>
            </span>
          </button>

          <a
            href={`/u/${username}/opengraph-image`}
            download={`loopstat-${username}.png`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-accent"
          >
            <Download className="size-4" />
            <span className="flex flex-col">
              <span>Télécharger l&apos;image</span>
              <span className="text-xs text-muted-foreground">
                Carte 1200×630, idéale pour Twitter / Discord
              </span>
            </span>
          </a>

          {canNativeShare ? (
            <button
              type="button"
              role="menuitem"
              onClick={nativeShare}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-accent"
            >
              <Share2 className="size-4" />
              Partager via mon appareil…
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
