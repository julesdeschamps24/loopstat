import type { StreamPeriod } from "./period";

/**
 * loopstat est entièrement gratuit (décision produit 2026-08-17, cf.
 * docs/adr/0001-produit-gratuit-retrait-stripe.md). Il ne reste ici que les
 * constantes d'affichage partagées par les pages /top/*.
 */

/** Période par défaut quand l'URL n'en précise pas. */
export const DEFAULT_PERIOD: StreamPeriod = "1w";

/** Nombre de lignes affichées dans un top. */
export const TOP_LIMIT = 100;
