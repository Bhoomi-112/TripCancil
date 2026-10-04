# PROGRESS

## P0 — Scaffold + theme + components (done)
- Next.js 16 App Router + TypeScript strict + Tailwind v4 (`@theme` tokens, no config file).
- Fonts: `Press Start 2P` (display) + `Nunito` (body), self-hosted via `next/font`.
- Palette tokens: cream / ink / electric / hot pink / lime / cyan / grape / silver / sunny,
  plus radii (`window`, `bubble`, `sticker`), shadows (`sticker`, `bubble`, `window`) and
  animations (`pop`, `wiggle`, `float`, `shimmer`, `slide-up`, `blink`, `twinkle`).
- Surface utilities: `gloss`, `dotted-grid`, `scanlines`, `iridescent`, `chrome-text`.
- Component library in `src/components/ui`: Button (+ `ButtonLink`, `IconButton`,
  `buttonClass`), Window (+ `WindowDots`), Input/Textarea/Field/Label, Badge (pill and
  sticker), Modal, Tabs (+ `TabPanel`), Avatar (+ `AvatarStack`), Toast
  (`ToastProvider`, `useToast`), EmptyState (6 pixel illustrations), Skeleton
  (+ `SkeletonText`, `SkeletonCard`).
- `/design` shows every component in every state; `/` is a Y2K splash.
- App shell: fixed sidebar from 768px up, bottom tab bar under it, five routes
  `/plan` `/map` `/money` `/photos` `/trip` (placeholders that demo skeleton + empty state).
- Verified: `npm run typecheck`, `npm run lint`, `npm run build` all clean; every route
  returns 200 in dev; all custom utilities and theme vars appear in the compiled CSS.
- Reduced motion respected globally; body copy is 16px+ and high contrast on cream.

## Deferred
- Nothing from P0.

## Known bugs
- Dev-only hydration warning on `<html data-scribe-recorder-ready>` injected by the Next 16
  dev overlay. Not present in the production build.

## Next: P1 — database schema
