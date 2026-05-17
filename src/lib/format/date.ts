/**
 * Formate une date en français long, par ex "22 novembre 2024".
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Formate une date en relatif si elle est récente ("hier", "il y a 7 jours"),
 * sinon délègue à `formatDate`. Seuil : 30 jours.
 *
 * `Intl.RelativeTimeFormat` avec `numeric: "auto"` produit "hier" / "aujourd'hui"
 * automatiquement pour -1 et 0 jours.
 */
export function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (Math.abs(diffDays) > 30) return formatDate(date);

  const rtf = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });
  return rtf.format(diffDays, "day");
}
