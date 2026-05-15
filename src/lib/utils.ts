import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMs(ms: number) {
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) return `${hours}h ${minutes}m`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return `${days}j ${remHours}h`;
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n);
}

/**
 * Glassmorphisme : carte translucide + backdrop-blur en dark, carte solide
 * classique en light. À utiliser à la place de "rounded-2xl border bg-card"
 * sur les cards qui doivent laisser passer le dégradé violet derrière.
 */
export const glassCard =
  "rounded-2xl border bg-card backdrop-blur-xl dark:bg-white/[0.04] dark:border-white/10";
