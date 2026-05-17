import Link from "next/link";

const LINK_COLOR = "#5a5070";

export function LandingFooter() {
  return (
    <footer
      className="flex flex-wrap items-center justify-between gap-4 border-t px-8 py-5 text-xs"
      style={{
        borderTopColor: "rgba(56, 50, 90, 0.4)",
        color: LINK_COLOR,
      }}
    >
      <div>© 2026 loopstat</div>
      <nav className="flex gap-4">
        <Link
          href="/terms"
          className="transition hover:opacity-80"
          style={{ color: LINK_COLOR }}
        >
          CGU
        </Link>
        <Link
          href="/privacy"
          className="transition hover:opacity-80"
          style={{ color: LINK_COLOR }}
        >
          Confidentialité
        </Link>
        <Link
          href="/legal"
          className="transition hover:opacity-80"
          style={{ color: LINK_COLOR }}
        >
          Mentions légales
        </Link>
      </nav>
    </footer>
  );
}
