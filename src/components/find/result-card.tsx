import Link from "next/link";
import { ChevronRight } from "lucide-react";

import type { PublicProfileSummary } from "@/db/queries/users";

export function ResultCard({ result }: { result: PublicProfileSummary }) {
  const name = result.displayName ?? result.username;
  return (
    <Link
      href={`/u/${result.username}`}
      className="flex items-center gap-4 rounded-2xl border bg-card p-4 transition hover:bg-accent"
    >
      {result.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={result.avatarUrl}
          alt=""
          width={48}
          height={48}
          className="size-12 rounded-full object-cover"
        />
      ) : (
        <div className="flex size-12 items-center justify-center rounded-full bg-[#7c3aed]/20 text-lg font-semibold text-[#c4b5fd]">
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{name}</p>
        <p className="truncate font-mono text-sm text-muted-foreground">
          @{result.username}
        </p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
