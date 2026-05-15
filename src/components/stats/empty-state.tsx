import { Inbox, type LucideIcon } from "lucide-react";
import { cn, glassCard } from "@/lib/utils";

/**
 * Friendly placeholder for "pas encore assez de données". Pure presentational.
 */
export type EmptyStateProps = {
  title: string;
  description?: string;
  /** Optional Lucide icon component. Defaults to `Inbox`. */
  icon?: LucideIcon;
};

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        glassCard,
        "flex flex-col items-center px-6 py-12 text-center",
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <p className="mt-4 font-medium">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}
