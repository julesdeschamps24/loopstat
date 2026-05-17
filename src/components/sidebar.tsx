"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Album,
  Clock,
  Download,
  Home,
  Music2,
  Settings,
  Users,
} from "lucide-react";

import { SearchBar } from "@/components/search-bar";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Tableau de bord", icon: Home },
  { href: "/top/tracks", label: "Top titres", icon: Music2 },
  { href: "/top/artists", label: "Top artistes", icon: Users },
  { href: "/top/albums", label: "Top albums", icon: Album },
  { href: "/listening-clock", label: "Horloge d'écoute", icon: Clock },
  { href: "/import", label: "Importer", icon: Download },
  { href: "/settings", label: "Réglages", icon: Settings },
] as const;

// Pages publiques où la sidebar n'a aucun sens (on est avant le login).
const PUBLIC_PATHS = new Set<string>(["/", "/login"]);

/**
 * Sidebar verticale 220 px, fixée à gauche sur >= md, masquée sur mobile.
 * Met l'item actif en gradient cyan→magenta (palette nébuleuse).
 */
export function Sidebar({ hasImported }: { hasImported: boolean }) {
  const pathname = usePathname();

  // Pas de sidebar sur les pages publiques (landing + login + profils
  // partagés) ni sur les routes d'erreur internes Next.
  if (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/u/")
  )
    return null;

  return (
    <aside className="hidden md:flex md:w-55 md:shrink-0 md:flex-col md:gap-1 md:border-r md:border-white/6 md:bg-white/3 md:backdrop-blur-xl md:p-4 md:sticky md:top-0 md:h-screen">
      <Link
        href="/dashboard"
        className="mb-4 px-2 py-3 font-brand font-bold text-4xl tracking-tight"
      >
        loopstat
      </Link>

      <div className="mb-4 px-1">
        <SearchBar />
      </div>

      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.filter(
          // Une fois importé, l'item "Importer" est remplacé par le petit
          // lien "Mettre à jour mon historique" en bas. Évite la double CTA.
          (item) => item.href !== "/import" || !hasImported,
        ).map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            // Detail pages (/track/[id], /artist/[id]…) ne matchent aucun
            // item de nav ; on laisse "Top X" actif quand on est dans un
            // détail correspondant.
            (href === "/top/tracks" && pathname.startsWith("/track/")) ||
            (href === "/top/artists" && pathname.startsWith("/artist/")) ||
            (href === "/top/albums" && pathname.startsWith("/album/"));
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                active
                  ? "bg-[#7c3aed] text-white font-medium"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {hasImported ? (
        <Link
          href="/import"
          className="mt-auto border-t border-white/5 px-3 pt-4 text-xs text-muted-foreground transition hover:text-foreground"
        >
          Mettre à jour mon historique
        </Link>
      ) : null}

      <div
        className={cn(
          "flex flex-wrap gap-x-3 gap-y-1 border-t border-white/5 px-3 pt-3 text-[10px] text-muted-foreground/70",
          // Si hasImported a déjà poussé son lien en mt-auto, ce bloc se
          // colle juste en dessous (mt-3). Sinon on l'envoie tout en bas
          // avec mt-auto pour qu'il colle au bottom de la sidebar.
          hasImported ? "mt-3" : "mt-auto",
        )}
      >
        <Link href="/legal" className="hover:text-foreground transition">
          Mentions légales
        </Link>
        <Link href="/privacy" className="hover:text-foreground transition">
          Confidentialité
        </Link>
        <Link href="/terms" className="hover:text-foreground transition">
          CGU
        </Link>
      </div>
    </aside>
  );
}
