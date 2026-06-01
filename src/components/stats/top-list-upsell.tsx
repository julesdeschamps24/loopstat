import Link from "next/link";
import { Crown } from "lucide-react";

/**
 * CTA shown below a free user's top-10 list. `noun` is the plural lowercased
 * thing being listed ("titres" | "artistes" | "albums").
 */
export function TopListUpsell({ noun }: { noun: string }) {
  return (
    <Link
      href="/pricing"
      className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-card px-5 py-4 text-center text-sm font-medium text-muted-foreground transition hover:text-foreground"
    >
      <Crown className="size-4 text-[#7c3aed]" />
      Tu vois ton top 10 {noun}. Débloque le top 100 et toutes les périodes avec
      Premium.
    </Link>
  );
}
