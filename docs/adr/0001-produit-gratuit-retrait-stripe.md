# ADR 0001 - loopstat devient entièrement gratuit, retrait de Stripe

Date : 2026-08-17
Statut : accepté

## Contexte

loopstat avait un modèle freemium : free = top 10 + périodes 1y/all,
Premium (Stripe Checkout + Customer Portal, mensuel/annuel avec trial 14 j) =
top 100, toutes les périodes, personnalisation du profil public, cartes sans
watermark. Aucune traction payante ; la friction du paywall nuisait au coeur
viral du produit (partage de profils et de cartes).

## Décision

Le produit est entièrement gratuit. Retrait complet de Stripe :

- Suppression des routes `/api/checkout`, `/api/portal`, `/api/stripe/webhook`,
  des pages `/pricing`, `/checkout/*`, `/settings/billing`, de `src/lib/stripe.ts`
  et de `src/db/queries/billing.ts`.
- Tout le monde a l'expérience complète : top 100, toutes les périodes
  (défaut `1w`), personnalisation du profil public.
- Le watermark `loopstat.fr/u/<username>` reste sur les cartes partagées et
  l'OG image pour tout le monde : c'est le canal d'acquisition, plus un perk.
- DB : drop des colonnes `stripe_customer_id`, `stripe_subscription_id`,
  `premium_status`, `premium_until` (migration versionnée). Perte assumée :
  plus d'historique d'abonnement en base ; l'historique reste dans le
  dashboard Stripe si besoin.
- Env : retrait de `STRIPE_*` partout (compose, examples, VPS).

## Conséquences

- Réintroduire un paiement un jour = nouvelle intégration (rien de latent à
  maintenir d'ici là).
- Penser à désactiver le webhook et l'abonnement de test côté dashboard Stripe.
