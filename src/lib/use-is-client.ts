import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * Retourne `false` au SSR/hydratation puis `true` une fois côté client, sans
 * déclencher le anti-pattern setState-in-effect (React 19 strict). Le rendu
 * serveur reste déterministe, et on bascule sur des APIs navigateur
 * (`window`, `navigator`) seulement après hydratation.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
