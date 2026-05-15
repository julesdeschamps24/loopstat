"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

// Subscribe-once no-op store: snapshot is `true` on client, `false` on server.
// This gives us a hydration-safe `mounted` flag without setState-in-effect.
function subscribe() {
  return () => {};
}
function getSnapshot() {
  return true;
}
function getServerSnapshot() {
  return false;
}

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  // Hydration guard: until mounted, render a dimension-matched neutral stub
  // so the server-rendered HTML doesn't mismatch the client's theme-dependent icon.
  if (!mounted) {
    return (
      <div
        aria-hidden="true"
        className="size-9 rounded-full border"
      />
    );
  }

  const current = theme === "system" ? resolvedTheme : theme;
  const isDark = current === "dark";
  const next = isDark ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={
        isDark ? "Passer en thème clair" : "Passer en thème sombre"
      }
      className="inline-flex size-9 items-center justify-center rounded-full border text-sm hover:bg-accent transition"
    >
      {isDark ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
    </button>
  );
}
