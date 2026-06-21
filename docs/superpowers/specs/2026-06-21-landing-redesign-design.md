# Landing page redesign — split hero with floating cluster

**Date:** 2026-06-21
**Status:** Approved design, ready for implementation plan
**Route:** `/` (`src/app/page.tsx`)

## Context & goal

The current landing (`src/app/page.tsx`) is a single centered hero — headline,
subtitle, Google sign-in, "voir un exemple" link — on a radial mauve
background. It feels empty and gives no sense of the product.

Goal: a **compact, above-the-fold** landing (everything visible without
scrolling) that is visually attractive, shows a glimpse of the product, and has
**gently floating/moving decorative elements** (inspired by
`divprotocol.com/fr`), all in loopstat's existing "Nébuleuse" design language.

## Chosen direction: B — split dynamic (hybrid)

Asymmetric split: value proposition + CTA on the left, an animated cluster of
real product fragments floating on the right. This reads closest to the
divprotocol energy (floating cluster) while showing the product (a mini
dashboard) and keeping a strong, legible message. Selected over A (centered,
symmetric — safer but flatter) and C (orbit/constellation — distinctive but
more playful/risky).

## Design constraints (locked)

- **Above the fold**: the whole page fits in `100svh`, no scroll, on desktop
  and mobile. Footer (legal links) included.
- **Hybrid floating elements**: real product fragments (album covers, a mini
  dashboard, KPI chips, the vinyl brand mark), not abstract shapes.
- **DA "Nébuleuse"**: violet `#7c3aed`, dark `#070710`, light-violet `#c4b5fd`,
  muted `#a89ec8`, radial mauve glow; Instrument Serif italic for numbers/accent
  word; Inter/system sans for the rest; glass cards
  (`rgba(244,240,255,0.06)` bg, `rgba(244,240,255,0.12)` border).

## Layout

`page.tsx` (server component) renders a full-height column:

```
min-h-[100svh] flex flex-col
├── LandingHeader            (existing — loopstat. / Tarifs)
├── <hero> flex-1           2-col grid (md+), single col (<md)
│   ├── left  (~45%)        text + CTA
│   └── right (~55%)        FloatingCluster
└── LandingFooter           slimmed to one thin row (legal links)
```

- Background: keep the radial mauve gradient, but shift the glow toward the
  top-right (over the cluster) to support the asymmetry:
  `radial-gradient(ellipse at 80% 0%, #1a0d2e 0%, #070710 62%)`.
- The grid collapses to one column below `md`.

### Left column (the message)

- `h1`: "Ton Spotify," + line break + "en chiffres." where "en chiffres." is
  Instrument Serif italic in `#c4b5fd`. Sans part: medium weight, ~38px (mobile)
  → ~56px (desktop), `letter-spacing: -0.03em`.
- Subtitle (`#a89ec8`, ~14–16px): "Tops, historique, listening clock — toutes
  tes stats, gratuit et sans pub." (final copy tunable.)
- CTA: existing `GoogleSignInButton`, then a "Voir un exemple →" link to
  `/u/demo` (`#c4b5fd`).
- Microcopy (`~13px`, dim): "Gratuit · 30 s · sans pub".

### Right column — FloatingCluster (the core)

A `position: relative` box holding absolutely-positioned floating children:

1. **Mini-dashboard card** — glass card, tilted ~-6°, header "Top titres" + 3
   rows, each: rank (Instrument Serif italic, muted) + a real album cover
   (~30px, rounded) + two stacked text lines (track name / artist).
2. **2–3 album covers** floating around the card (real covers, ~44–50px,
   rounded, varied tilt).
3. **1 KPI chip** — glass, Instrument Serif italic number + small muted label:
   "4 499 h" / "au total".
4. **Vinyl mark** — the favicon motif (white disc, dark center, violet spindle),
   ~44px, as one floating satellite — ties the landing to the new brand icon.

Exact positions are tuned during implementation against the approved mockup
(`landing_dir_b_split`); the spec fixes the element set and their roles, not
pixel coordinates.

## Motion

- **Base float**: CSS `@keyframes` translating each element on Y (~10px
  amplitude) plus a small constant rotation (the element's tilt), 6–9s
  durations, staggered `animation-delay` so they breathe out of phase. Defined
  once in `globals.css`; elements opt in with a class + CSS custom props
  (`--d` duration, `--dl` delay, `--r` tilt).
- **Mouse parallax (subtle)**: on pointer move over the hero, shift cluster
  elements by a few px proportional to cursor offset (different factors per
  element for depth). Implemented in the `FloatingCluster` client component via
  a `requestAnimationFrame`-throttled `pointermove` handler writing a CSS
  variable (e.g. `--px`, `--py`) on each element; transforms compose with the
  float animation (translate the parallax on a wrapper so it doesn't fight the
  keyframe transform).
- **Disabled when**: `prefers-reduced-motion: reduce` (freeze all motion,
  elements rest in their tilt) and on coarse/touch pointers (no parallax).

## Responsive

- **md+**: 2-column split as above.
- **< md**: single column — text block on top (centered), a
  **simplified cluster** below (mini-dashboard centered + 2 album covers + 1
  KPI chip; drop the rest), reduced sizes. Must still fit `100svh` with no
  scroll. Float keeps; parallax off (touch).

## Data source: curated static assets

The landing is shown to **logged-out visitors** (no user data) and must be fast
and dependency-free, so it stays a **static server component with no DB query**.

- Curate 6 real album covers from the seeded **demo** catalog, downloaded from
  their Deezer cover URLs into `public/landing/` (optimized). Default set
  (implementation may swap for visual balance):
  - Mini-dashboard rows 1–3: Espresso / Sabrina Carpenter, BIRDS OF A FEATHER /
    Billie Eilish, Beautiful Things / Benson Boone (the demo top-3).
  - Floating covers: Fortnight / Taylor Swift, Houdini / Eminem,
    Texas Hold 'Em / Beyoncé.
  The implementation plan resolves the exact Deezer URLs by querying the demo
  catalog (`DEMO_TOP_TRACKS` + `enrichDemoFixtures`) once, then bakes the files.
- The mini-dashboard's 3 rows (track + artist names) are **hardcoded** to match
  rows 1–3 above.
- Rationale chosen over live demo data: instant, cacheable, no DB hit on a
  public page, resilient if the DB is slow.

## Components & files

**New**
- `src/components/landing/floating-cluster.tsx` — client component: the
  cluster's markup + float classes + parallax handler. Accepts the curated
  cover paths + dashboard rows as props (or imports a small local config).

**Modified**
- `src/app/page.tsx` — restructure into the split layout (server component;
  passes curated data to `FloatingCluster`).
- `src/app/globals.css` — add the float `@keyframes` + helper class +
  `prefers-reduced-motion` guard.
- `src/components/landing/landing-footer.tsx` — slim to one thin row so the page
  stays above the fold.
- Possibly `landing-header.tsx` — unchanged unless spacing needs a tweak.

**Assets**
- `public/landing/` — ~6 curated, optimized album cover images.

## Accessibility

- Decorative floating elements: `aria-hidden="true"`, empty `alt`.
- Respect `prefers-reduced-motion`.
- The `h1`, subtitle, and CTAs are real, focusable, in DOM order.
- Color contrast: text colors already meet contrast on the dark bg (existing DA).

## Non-goals / out of scope

- No copywriting overhaul (keep current positioning; minor subtitle tweak only).
- No change to `/pricing`, `/u/[username]`, or auth.
- No live/personalized landing data.
- No new dependency (animation is CSS + a tiny vanilla parallax handler — no
  animation library).

## Verification

- Visual: matches the approved `landing_dir_b_split` mockup; floats + parallax
  feel subtle; fits `100svh` with no scroll at common desktop and mobile sizes.
- `prefers-reduced-motion`: motion stops.
- `pnpm typecheck` + `pnpm lint` green; `pnpm build` succeeds (the landing is a
  public route — verify it renders without runtime env).
- Deploy: ships with the next prod redeploy.
