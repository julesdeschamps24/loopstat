"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Album, Home, Music2, Settings, Users } from "lucide-react";

import { isNavHidden, resolveDemoHref } from "@/components/nav-config";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", label: "Accueil", icon: Home },
  { href: "/top/tracks", label: "Titres", icon: Music2 },
  { href: "/top/artists", label: "Artistes", icon: Users },
  { href: "/top/albums", label: "Albums", icon: Album },
  { href: "/settings", label: "Réglages", icon: Settings },
] as const;

/**
 * Bottom tab bar mobile (< md). Pendant complementaire de la Sidebar :
 * memes regles de visibilite, memes reecritures de liens en mode demo.
 * L'horloge d'ecoute et l'import restent accessibles depuis le dashboard.
 */
export function MobileNav({ authed }: { authed: boolean }) {
  const pathname = usePathname();
  if (isNavHidden(pathname)) return null;

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/8 bg-[#0b0714]/90 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const target = resolveDemoHref(href, authed);
        const active =
          pathname === target ||
          pathname === href ||
          (href === "/top/tracks" && pathname.startsWith("/track/")) ||
          (href === "/top/artists" && pathname.startsWith("/artist/")) ||
          (href === "/top/albums" && pathname.startsWith("/album/"));
        return (
          <Link
            key={href}
            href={target}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 px-1 py-2.5 text-[10px] font-medium transition",
              active ? "text-[#c4b5fd]" : "text-muted-foreground",
            )}
          >
            <Icon className={cn("size-5", active && "text-[#7c3aed]")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
