interface Props {
  children: React.ReactNode;
}

/**
 * Inline help icon that reveals a tooltip on hover/focus. CSS-only - no JS,
 * works fine as a server component. The tooltip floats above the icon with
 * a small arrow, capped at ~260px wide so it stays compact.
 */
export function HelpTooltip({ children }: Props) {
  return (
    <span className="group/tip relative inline-flex items-center align-middle">
      <button
        type="button"
        aria-label="Aide"
        tabIndex={0}
        className="flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-white/20 bg-white/5 text-[10px] font-semibold text-muted-foreground transition hover:border-white/40 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-max max-w-[260px] -translate-x-1/2 rounded-lg border border-white/10 bg-[#0a0612] px-3 py-2 text-xs font-normal leading-snug text-foreground opacity-0 shadow-xl transition group-hover/tip:opacity-100 group-focus-within/tip:opacity-100"
      >
        {children}
      </span>
    </span>
  );
}
