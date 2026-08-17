# Refonte de la page d'accueil `/` - design spec

**Date** : 2026-05-17
**Auteur** : Jules + Claude (brainstorming session)
**Scope** : `src/app/page.tsx` uniquement

## Contexte et motivation

La page d'accueil actuelle ([src/app/page.tsx](../../../src/app/page.tsx)) est un hero
minimaliste (H1 + sous-titre + CTA vert Spotify) qui souffre d'incohérences
chromatiques avec le reste du dark mode :

- `--primary` (vert Spotify `#1ed760`) sert à la fois de couleur de marque
  globale **et** de couleur fonctionnelle "auth Spotify" - confusion sémantique.
- Le dark mode établit pourtant une identité forte **nébuleuse violet/mauve**
  (`#070710` + radial `#1a0d2e`, accent `#7c3aed`) qui n'est pas exploitée
  sur la landing.
- Le bouton CTA en vert pop trop fort sur un fond non-vert prévu pour lui,
  cassant la cohérence visuelle dès le premier écran.

Cette refonte n'altère **pas** `globals.css` ni le reste de l'app : elle se
limite à la page d'accueil, qui peut légitimement porter sa propre identité
de landing tout en restant cohérente avec la suite du parcours.

## Décisions de design

| Sujet | Décision | Alternative écartée |
|---|---|---|
| Direction couleur | Nébuleuse violet (palette dark existante embrassée) | Spotify green dominant ; mono noir/blanc |
| Structure | Hero plein écran, 1 vue | Landing scrollable avec sections produit ; hero animé mur d'albums |
| Typographie | Inter sans-serif (déjà chargé) | DM Serif Display + italique ; Bricolage Grotesque chunky |
| CTA primaire | Bouton vert Spotify officiel + icône SVG | Bouton violet de marque ; CTA seul sans lien démo |
| CTA secondaire | Lien lavande "Voir un exemple →" vers `/u/demo` | Pas de lien démo |
| Mode | Force dark uniquement sur cette page | Support light mode |

## Spec visuelle

### Layout

```
┌────────────────────────────────────────────────────┐
│  loopstat.                              Tarifs     │   ← header 24px padding
├────────────────────────────────────────────────────┤
│                                                    │
│                                                    │
│               Ton Spotify,                         │   ← H1 64px / 40px mobile
│               en chiffres.                         │     ("en chiffres" en lavande)
│                                                    │
│        Tops, historique d'écoute, listening        │   ← sous-titre 18px
│        clock - toutes tes stats Spotify,           │
│        gratuites et sans pub.                      │
│                                                    │
│      [● Continuer avec Spotify]  Voir un exemple → │   ← CTA + lien
│                                                    │
│            Gratuit · 30 secondes · sans pub        │   ← trust line 13px
│                                                    │
│                                                    │
├────────────────────────────────────────────────────┤
│  © loopstat 2026          CGU · Privacy · Légal    │   ← footer 12px
└────────────────────────────────────────────────────┘
```

### Palette (cette page uniquement - ne touche pas globals.css)

| Rôle | Hex | Usage |
|---|---|---|
| Background base | `#070710` | Fond principal |
| Background top | `#1a0d2e` | Centre du radial mauve |
| Text primary | `#f4f0ff` | Titres, mots-clés |
| Text secondary | `#a89ec8` | Sous-titre, navigation header |
| Text faint | `#5a5070` | Trust line, footer, copyright |
| Accent (lavande) | `#c4b5fd` | "en chiffres", lien "Voir un exemple →" |
| Brand point | `#7c3aed` | Le point après "loopstat" dans le wordmark |
| Border subtil | `rgba(56,50,90,0.4)` | Séparateur footer |
| Spotify green | `#1ed760` | Bouton CTA uniquement |
| Spotify text on green | `#0a0a0a` | Texte du bouton CTA |

Le radial est appliqué via `body::before` dans `.dark` (déjà existant
[globals.css:65](../../../src/app/globals.css#L65)) - la force-dark suffit pour
l'activer.

### Typographie

| Élément | Font | Weight | Size desktop / mobile | Letter-spacing |
|---|---|---|---|---|
| Wordmark | Inter | 700 | 18px | -0.02em |
| H1 | Inter | 700 | 64px / 40px | -0.03em |
| Sous-titre | Inter | 400 | 18px / 16px | normal |
| CTA button | Inter | 700 | 15px | normal |
| Lien démo | Inter | 500 | 15px | normal |
| Trust line | Inter | 400 | 13px | normal |
| Footer | Inter | 400 | 12px | normal |

H1 line-height : `1.0` desktop, `1.05` mobile. Sous-titre line-height : `1.5`.

### CTA primaire (bouton Spotify)

- Background : `#1ed760`
- Text color : `#0a0a0a`
- Padding : `14px 28px`
- Border-radius : `99px` (full pill)
- Icon : SVG Spotify officiel 18×18, à gauche du texte
- Gap interne : `10px`
- Hover : `opacity: 0.9`
- Focus visible : outline `#7c3aed` 2px (déjà global)
- Label : "Continuer avec Spotify"

### CTA secondaire (lien démo)

- Color : `#c4b5fd`
- Hover : `color: #f4f0ff`
- Pas de soulignement par défaut, underline au hover
- Padding cliquable : `14px 12px`
- Label : "Voir un exemple →" (flèche en `<span style="opacity: 0.6">`)
- Cible : `/u/demo` (voir dépendance ci-dessous)

### Responsive

- Mobile (`< 640px`) : H1 passe à 40px, padding hero à 24px, CTA et lien
  démo s'empilent verticalement avec `gap: 12px`
- Tablet/desktop : layout actuel (CTA + lien côte à côte, gap `16px`)

## Composants à modifier / créer

### Modifier

- **[src/app/page.tsx](../../../src/app/page.tsx)** - refactor complet selon la spec
  ci-dessus

### Créer

- **`src/components/landing/spotify-cta-button.tsx`** - bouton réutilisable
  intégrant l'icône SVG Spotify officielle (la même que sur `/login`, à
  factoriser depuis [src/components/spotify-login-button.tsx](../../../src/components/spotify-login-button.tsx)
  si possible). Props : `href`, `variant: "hero" | "compact"`.

- **`src/components/landing/landing-header.tsx`** - header simple
  wordmark + lien Tarifs. Pas réutilisable ailleurs (header différent
  sur les pages internes via la sidebar), mais isole proprement.
  - Wordmark `loopstat.` (le point en `#7c3aed`) est un `<Link href="/">`
  - Lien droite : `<Link href="/pricing">Tarifs</Link>`

- **`src/components/landing/landing-footer.tsx`** - variante allégée du
  footer (juste copyright + 3 liens légaux). Si [src/components/legal-footer.tsx](../../../src/components/legal-footer.tsx)
  est déjà minimal, on le réutilise tel quel ou avec une prop `variant`.

### Force dark - sans dépendre du `ThemeProvider`

La page doit afficher la palette violet/mauve indépendamment de
`prefers-color-scheme: light`. Deux pièges à éviter :

1. **`body::before` est inutilisable depuis la page** : le radial mauve est
   défini sur `.dark body::before` ([globals.css:65](../../../src/app/globals.css#L65))
   et dépend de la classe `dark` posée sur `<html>` par le `ThemeProvider`.
   Un wrapper `<div className="dark">` à l'intérieur de la page **n'activera
   pas** ce pseudo-élément (la cible CSS exige que `body` soit descendant
   de `.dark`, pas un div).
2. **Ne pas modifier le `ThemeProvider`** au niveau layout - il sert pour
   tout le reste de l'app.

**Solution** : la landing peint son propre fond inline sans dépendre de
`.dark`. Le wrapper racine de `page.tsx` applique :

```tsx
<main
  className="min-h-screen flex flex-col"
  style={{
    background: "radial-gradient(ellipse at top, #1a0d2e 0%, #070710 60%)",
    color: "#f4f0ff",
  }}
>
  {/* contenu */}
</main>
```

Toutes les couleurs (texte, accents, borders) sont appliquées en utilities
Tailwind avec valeurs arbitraires (`text-[#f4f0ff]`, `bg-[#1ed760]`, etc.)
ou via classes utilitaires définies localement - **jamais** via
`text-foreground` ou `bg-background` (qui dépendent du thème actif).

Conséquence : la landing est totalement déconnectée de `ThemeProvider`,
fonctionne identiquement en light et dark mode système.

## Dépendances externes

### Profil démo `/u/demo`

Le lien "Voir un exemple →" nécessite un profil public et "intéressant" à
l'URL `/u/demo`. Ce profil est hors-scope de cette spec mais en bloque la
mise en prod du lien.

**Comportement intermédiaire** : tant que `/u/demo` n'existe pas, le lien
renvoie un 404 (la logique `getPublicProfileByUsername` returns null
→ `notFound()`). Acceptable pour livrer la landing seule.

**Spec séparée à écrire** : seeding d'un user `username='demo'`,
`is_public=true`, avec ~6 mois de streams plausibles couvrant 30+ artistes
variés, des skips, du listening clock distribué. À traiter dans une session
brainstorming séparée.

## Stratégie de test

- **Visuel** : vérifier à 1280px, 768px, 375px (Chromium DevTools)
- **Force dark** : tester avec `prefers-color-scheme: light` forcé dans
  DevTools → la page doit rester dark
- **CTA Spotify** : `/login` doit déclencher le flow OAuth comme avant
  (aucune régression d'auth)
- **Lien démo** : doit pointer `/u/demo` même si 404 actuellement
- **Accessibilité** : test au clavier (Tab → CTA → lien démo → header link),
  focus visible partout, contraste vérifié avec outil WCAG
- **`prefers-reduced-motion`** : RAS (pas d'animation dans cette spec)
- **SEO** : `metadata.title` et `metadata.description` du layout
  s'appliquent - pas de besoin d'override

## Hors-scope explicite

- Refonte de `globals.css` ou des `--primary` / `--background` racine
- Refonte de `/login`, `/pricing`, ou autre page
- Création du profil `/u/demo` (spec séparée)
- Refactor de la sidebar ou de la palette des nav items
- Animation / motion (pourra être ajouté dans une itération future)
- A/B testing du copy
