export default function TrackDetailLoading() {
  return (
    <main className="flex-1 flex flex-col px-6 py-12 max-w-3xl mx-auto w-full">
      {/* Hero section: artwork placeholder + text stack */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
        {/* Artwork placeholder: size-48 rounded-2xl */}
        <div className="size-48 shrink-0 rounded-2xl bg-muted animate-pulse shadow-lg" />

        {/* Text block: label, title, artist, album */}
        <div className="min-w-0 space-y-3">
          <div className="h-3 w-12 rounded bg-muted animate-pulse" />
          <div className="h-8 w-64 rounded bg-muted animate-pulse" />
          <div className="h-5 w-48 rounded bg-muted animate-pulse" />
          <div className="h-4 w-40 rounded bg-muted animate-pulse" />
        </div>
      </div>

      {/* Stats section: card container with content placeholders */}
      <section className="mt-10 rounded-2xl border bg-card p-6">
        <div className="h-5 w-24 rounded bg-muted animate-pulse" />
        <div className="mt-4 space-y-2">
          <div className="h-8 w-32 rounded bg-muted animate-pulse" />
          <div className="h-4 w-48 rounded bg-muted animate-pulse" />
          <div className="h-4 w-48 rounded bg-muted animate-pulse" />
        </div>
      </section>
    </main>
  );
}
