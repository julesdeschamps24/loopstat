import Link from "next/link";
import { Music } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A single numbered entity row (track, artist, album, genre…).
 *
 * Renders as a `next/link` when `href` is provided, otherwise a plain `div`.
 * The image is optional — when absent a neutral placeholder is shown.
 */
export type RankedRowProps = {
  /** 1-based rank, displayed on the left. */
  rank: number;
  /** Main label (track/artist/album name). */
  title: string;
  /** Optional secondary line (e.g. artist name under a track title). */
  subtitle?: string;
  /** Optional artwork URL. When omitted a placeholder icon is rendered. */
  imageUrl?: string;
  /** Optional right-side content, e.g. a playcount badge. */
  metric?: React.ReactNode;
  /** When set, the whole row becomes a link to this href. */
  href?: string;
};

export function RankedRow({
  rank,
  title,
  subtitle,
  imageUrl,
  metric,
  href,
}: RankedRowProps) {
  const inner = (
    <>
      <span className="w-6 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
        {rank}
      </span>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="size-12 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Music className="size-5 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{title}</p>
        {subtitle ? (
          <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {metric != null ? (
        <div className="shrink-0 text-sm text-muted-foreground">{metric}</div>
      ) : null}
    </>
  );

  const className = cn(
    "flex items-center gap-3 rounded-xl px-3 py-2",
    href && "transition hover:bg-accent",
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}

/**
 * Wraps a list of `RankedRow`s with consistent vertical spacing.
 *
 * Composition-based: pass `RankedRow` elements as `children`. This keeps the
 * row contract (metric can be arbitrary JSX, href is per-row) flexible without
 * an item-shape abstraction.
 */
export type RankedListProps = {
  children: React.ReactNode;
  className?: string;
};

export function RankedList({ children, className }: RankedListProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>{children}</div>
  );
}
