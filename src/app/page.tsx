import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
      <div className="max-w-2xl text-center space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs uppercase tracking-wider text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary animate-pulse" />
          MVP local — Phase 0
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight">
          Ton Spotify, <span className="text-primary">en chiffres</span>.
        </h1>
        <p className="text-lg text-muted-foreground">
          Tops, historique d&apos;écoute, listening clock — toutes tes stats Spotify,
          gratuites et sans pub.
        </p>
        <div className="flex items-center justify-center gap-3 pt-4">
          <Link
            href="/login"
            className="rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground hover:opacity-90 transition"
          >
            Se connecter avec Spotify
          </Link>
        </div>
      </div>
    </main>
  );
}
