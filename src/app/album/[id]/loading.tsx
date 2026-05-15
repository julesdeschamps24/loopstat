export default function AlbumDetailLoading() {
  return (
    <main
      role="status"
      aria-busy="true"
      aria-label="Chargement"
      className="flex-1 flex flex-col px-6 py-12 max-w-3xl mx-auto w-full"
    >
      {/* Hero section: artwork placeholder + text stack */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
        {/* Artwork placeholder: size-48 rounded-2xl */}
        <div className="size-48 shrink-0 rounded-2xl bg-muted animate-pulse shadow-lg" />

        {/* Text block: label, title, artist, release info, playcount */}
        <div className="min-w-0 space-y-3">
          <div className="h-3 w-12 rounded bg-muted animate-pulse" />
          <div className="h-8 w-64 rounded bg-muted animate-pulse" />
          <div className="h-5 w-48 rounded bg-muted animate-pulse" />
          <div className="h-4 w-40 rounded bg-muted animate-pulse" />
          <div className="h-4 w-36 rounded bg-muted animate-pulse" />
        </div>
      </div>

      {/* Tracks section */}
      <section className="mt-10">
        <div className="mb-4 h-5 w-16 rounded bg-muted animate-pulse" />
        <div className="flex flex-col gap-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl px-3 py-2"
            >
              {/* Track number placeholder */}
              <div className="w-6 shrink-0">
                <div className="h-4 w-4 rounded bg-muted animate-pulse" />
              </div>
              {/* Track name placeholder */}
              <div className="min-w-0 flex-1">
                <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
