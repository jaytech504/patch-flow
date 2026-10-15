# PatchFlow Apple Design System Specification

## 1. Core Principles (Apple & Emil Kowalski Distillation)

1. **Response**: Physical interfaces respond the moment touch occurs (`pointerdown`), not upon release. Tactile scale compression occurs within 100ms.
2. **Direct Manipulation**: Content and finger move 1:1. Grab offset is preserved; gestures track continuously.
3. **Interruptibility**: Animations are never fire-and-forget. Any moving card, modal, or drawer can be grabbed and reversed mid-flight without positional jumps or brick-wall cuts.
4. **Spring Physics**:
   - Critically damped (`damping: 1.0`, `bounce: 0`): Default UI state transitions (calm, predictable, zero distraction).
   - Momentum damped (`damping: 0.8`, `bounce: 0.18`): Used strictly when preceded by user momentum (flick, swipe, throw).
5. **Materials & Depth**:
   - Translucent hierarchy (`backdrop-filter: blur(20px) saturate(180%)`).
   - Specular edges (`box-shadow: inset 0 1px 0 0 rgba(255,255,255,0.8)`): catching ambient light.
   - Soft layered elevation shadows instead of harsh 1px borders.
6. **Typography**:
   - Optical tracking: size-specific (`-0.028em` for large hero titles down to `+0.02em` for small uppercase captions).
   - Inverse leading: tighter on titles (`1.08`), spacious on body text (`1.55`).

---

## 2. Token Dictionary

### A. Color Palette (Strictly Preserved Brand Identity)

| Token | Light Theme | Dark Theme | Purpose |
| :--- | :--- | :--- | :--- |
| `--primary` | `#FF5A1F` | `#FF5A1F` | Flame Orange brand accent & primary CTAs |
| `--primary-hover` | `#E04E16` | `#FF7038` | Interactive hover state |
| `--background` | `#FAFAF9` | `#0D0D0C` | Warm stone canvas background |
| `--foreground` | `#111110` | `#F5F5F4` | Onyx primary text |
| `--card` | `#FFFFFF` | `#161615` | Surface card layer |
| `--border` | `#E7E5E2` | `#262623` | Subtle structural division |
| `--border-strong` | `#D4D1CC` | `#3A3A35` | Interactive control borders |
| `--text-secondary`| `#6F6B66` | `#9C9891` | Secondary guidance copy |
| `--accent` | `#FFEDE3` | `#2E1B13` | Soft orange tinted badge / highlight |
| `--accent-foreground`| `#E04E16` | `#FF7038` | High contrast accent text |
| `--success` | `#16A34A` | `#16A34A` | Passed compile / clean test |
| `--warning` | `#D97706` | `#D97706` | Degraded chaos latency |
| `--destructive` | `#DC2626` | `#EF4444` | Unhandled crash / 500 error |

### B. Typography Tokens

| Class | Font Size | Line Height | Tracking | Weight | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `.apple-display` | `clamp(2.25rem, 5vw, 3.75rem)` | `1.08` | `-0.028em` | `800` | Hero display headlines |
| `.apple-title-1` | `clamp(1.75rem, 3.5vw, 2.5rem)` | `1.15` | `-0.024em` | `700` | Major page headings |
| `.apple-title-2` | `clamp(1.35rem, 2.5vw, 1.75rem)` | `1.22` | `-0.018em` | `700` | Section titles & modal headers |
| `.apple-title-3` | `1.25rem` | `1.30` | `-0.014em` | `600` | Card titles, group titles |
| `.apple-headline`| `1.00rem` | `1.40` | `-0.011em` | `600` | Subsections, item names |
| `.apple-body` | `0.9375rem` | `1.55` | `-0.004em` | `400` | Paragraph text, descriptions |
| `.apple-callout` | `0.875rem` | `1.45` | `0.000em` | `500` | Metric labels, callouts |
| `.apple-subhead` | `0.8125rem` | `1.40` | `+0.004em` | `500` | Table metadata, subtitles |
| `.apple-footnote`| `0.75rem` | `1.35` | `+0.012em` | `400` | Timestamps, footnote captions |
| `.apple-caption` | `0.6875rem` | `1.30` | `+0.020em` | `600` | Uppercase category tags |

### C. Apple Spring Physics Presets (`src/lib/springs.ts`)

| Preset | Bounce | Duration | Damping Ratio Equivalent | Use Case |
| :--- | :---: | :---: | :---: | :--- |
| `appleSprings.default` | `0.0` | `0.35s` | `1.0` (Critically Damped) | Default UI entry, layout changes, tabs |
| `appleSprings.snappy` | `0.0` | `0.24s` | `1.0` (Fast) | Button presses, toggle switches, hover |
| `appleSprings.momentum`| `0.18`| `0.38s` | `0.8` (Slight Overshoot) | Drag releases, flick landings |
| `appleSprings.sheet` | `0.12`| `0.34s` | `0.85` | Mobile drawers, sliding sidebars |
| `appleSprings.popover` | `0.05`| `0.28s` | `0.95` | Context menus, dropdown triggers |
| `appleSprings.reducedMotion`| N/A | `0.16s` | Tween Crossfade | Users with `prefers-reduced-motion` |

### D. Layered Materials & Specular Lighting

- `.apple-glass`: `backdrop-filter: blur(20px) saturate(180%)` with subtle translucent canvas tint and hairline outline.
- `.apple-specular-edge`: Inset 1px highlight line mimicking ambient light reflecting off chamfered hardware.
- `.apple-press`: Instant tactile downscale to `0.972` on `:active` with smooth spring release.

---

## 3. Accessibility Degradation Matrix

1. **`prefers-reduced-motion: reduce`**:
   - Transform animations (`scale`, `translate`, `rotate`) are zeroed.
   - Sheet and modal entries gracefully degrade to a 160ms opacity crossfade.
   - Terminal line appearances transition instantaneously or via simple opacity.
2. **`prefers-reduced-transparency: reduce`**:
   - `backdrop-filter` is disabled.
   - Translucent headers, sidebars, and overlays switch to 100% solid background fills.
3. **`prefers-contrast: more`**:
   - Border contrast jumps from `0.06` opacity to solid high-contrast borders.
   - Text secondary colors darken to meet AAA legibility ratios.
