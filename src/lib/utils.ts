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

/**
 * Gradient cyan→magenta de la palette Nébuleuse. Texte noir pour le contraste
 * sur le gradient clair. Utilisé sur les CTA secondaires et les états actifs.
 */
export const gradientCta =
  "bg-linear-to-br from-[#5dd9ff] to-[#ff5dc8] text-black hover:opacity-90 transition";

/**
 * Variante "texte" du gradient cyan→magenta (clip-path sur le texte). Pour
 * les liens "Voir tout" et autres accents typographiques.
 */
export const gradientText =
  "bg-linear-to-r from-[#5dd9ff] to-[#ff5dc8] bg-clip-text text-transparent";
