import Link from "next/link";

/**
 * Petit pied de page avec les liens légaux obligatoires (RGPD + LCEN).
 * À placer sur les pages publiques (`/`, `/login`) et toute page accessible
 * sans auth. Les pages authentifiées exposent les mêmes liens en bas de
 * la sidebar.
 */
export function LegalFooter() {
  return (
    <footer className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-6 py-6 text-xs text-muted-foreground">
      <span>© 2026 loopstat</span>
      <Link href="/legal" className="hover:text-foreground transition">
        Mentions légales
      </Link>
      <Link href="/privacy" className="hover:text-foreground transition">
        Confidentialité
      </Link>
      <Link href="/terms" className="hover:text-foreground transition">
        CGU
      </Link>
    </footer>
  );
}
