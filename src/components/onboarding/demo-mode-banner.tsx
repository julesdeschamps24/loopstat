import Link from "next/link";

/**
 * Sticky bar affichée en haut des pages stats quand l'user n'a pas encore
 * importé son JSON Spotify. Rappelle que les données affichées sont
 * fictives et CTA vers /import.
 */
export function DemoModeBanner() {
  return (
    <div
      className="sticky top-0 z-40 flex items-center justify-center gap-2 px-4 py-3 text-sm"
      style={{
        background: "rgba(124, 58, 237, 0.18)",
        color: "#c4b5fd",
        borderBottom: "1px solid rgba(124, 58, 237, 0.4)",
        backdropFilter: "blur(8px)",
      }}
    >
      <span>👋 Données fictives -</span>
      <Link
        href="/import?from=welcome"
        className="font-semibold underline underline-offset-2 hover:opacity-80"
        style={{ color: "#f4f0ff" }}
      >
        Importe tes vraies stats →
      </Link>
    </div>
  );
}
