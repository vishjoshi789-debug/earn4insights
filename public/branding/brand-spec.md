# Earn4Insights — Brand Specification

Version 1.0 — Logo system, colors, typography, and usage rules.

---

## 1. Positioning & Tagline

**Positioning statement** (website hero, pitch deck, About page):
> The consumer intelligence infrastructure where brands, consumers, and influencers meet.

**Tagline** (logo lockup, short contexts):
> Consumer intelligence infrastructure

**One-liner** (social bios, app store):
> Consumer intelligence infrastructure connecting brands, their consumers, and influencers.

---

## 2. The Mark — "E-Lens"

A rounded indigo tile containing a bold "E" formed by three bars. The middle bar is shortened and a gold dot sits to its right — together reading as an eye/aperture. The dual meaning: **E** (the brand) + **eye** (insight/seeing). The bottom bar is gold, echoing the gold "4" in the wordmark.

**Why it works:** Bold solid-tile = infrastructure feel (like Stripe, Vercel). Hidden eye = the intelligence story. Survives every size down to 16px.

---

## 3. Color System

### Primary — Indigo (the gradient tile)
| Token | Hex | Use |
|-------|-----|-----|
| Indigo start | `#4F46E5` | Gradient top-left |
| Indigo end | `#7C3AED` | Gradient bottom-right |
| Indigo light (mono) | `#A5B4FC` | Light bars on dark mono icon |

Gradient direction: top-left → bottom-right (`x1=0 y1=0 x2=1 y2=1`).

### Accent — Gold (the "earn" / value / eye)
| Token | Hex | Use |
|-------|-----|-----|
| Gold | `#F59E0B` | Wordmark "4", light-bg accents |
| Gold bright | `#FBBF24` | The eye dot, dark-bg accents |
| Gold deep | `#D97706` | "4" on light backgrounds (better contrast) |

### Neutrals
| Token | Hex | Use |
|-------|-----|-----|
| Ink | `#1E1B2E` | Wordmark text on light |
| Near-black | `#0F0F1A` | Dark surfaces / mono dark tile |
| White | `#FFFFFF` | Wordmark on dark, bars |
| Muted indigo | `#A5B4FC` | Tagline on dark |
| Muted gray | `#6B7280` | Tagline on light |

### Color rules
- **Never** more than indigo + gold + one neutral in a single composition.
- The gold "4" in the wordmark is mandatory — it ties wordmark to mark.
- On light backgrounds, use Gold deep `#D97706` for the "4" (contrast).
- On dark backgrounds, use Gold `#F59E0B` for the "4".

---

## 4. Typography

**Wordmark font:** Inter (weight 600), letter-spacing -1. Fallback: Helvetica Neue, Arial, sans-serif.
- If you use a different brand font in-app, keep the wordmark in Inter 600 for consistency.

**Tagline:** Inter 500, letter-spacing 2.8, ALL CAPS, small (10–13px).

**Wordmark styling:** `Earn` + gold `4` + `Insights`, all one word, no spaces. The `4` is always the gold accent.

---

## 5. Logo Files

| File | Use |
|------|-----|
| `logo-primary-dark.svg` | Main lockup on dark surfaces (your app) |
| `logo-primary-light.svg` | Main lockup on light (email, invoice, PDF) |
| `logo-horizontal-dark.svg` | Nav bar, dark |
| `logo-horizontal-light.svg` | Nav bar, light |
| `logo-stacked-dark.svg` | Social avatars, splash screens |
| `icon-app.svg` | App icon, full color (PWA, app stores) |
| `icon-mono-dark.svg` | Monochrome dark contexts |
| `icon-mono-light.svg` | Monochrome light contexts |
| `favicon.svg` | Browser tab (16–32px optimized) |

---

## 6. Clear Space & Sizing

- **Clear space:** Keep padding around the logo equal to the height of the tile's corner radius on all sides.
- **Minimum sizes:**
  - Full lockup: 160px wide minimum
  - Icon: 16px minimum (favicon); below that, legibility drops
- **Corner radius scales with tile size** (~18% of tile width). At 120px tile → rx 22. At 32px → rx 6.

---

## 7. Do / Don't

**Do:**
- Use the gradient tile as the primary mark.
- Keep the gold "4" in every wordmark instance.
- Use mono variants when color printing isn't available.
- Maintain clear space.

**Don't:**
- Don't recolor the tile outside indigo→violet.
- Don't remove the gold eye dot.
- Don't stretch, skew, or rotate the mark.
- Don't add drop shadows or outer glows.
- Don't put the wordmark in Title Case ("Earn4insights" is correct; "Earn 4 Insights" is not).
- Don't place the gradient tile on a busy photographic background without a solid pad behind it.

---

## 8. Implementation Notes (for Claude Code)

- All files are SVG (infinitely scalable, theme-friendly).
- For the favicon, reference `favicon.svg` in `<link rel="icon" type="image/svg+xml" href="/favicon.svg">`.
- For PWA / app manifest, generate PNG exports of `icon-app.svg` at 192px and 512px.
- The app is dark-themed → default to `-dark` logo variants in the UI; use `-light` for outbound email templates and PDF invoices.
- Gradient ID collisions: if embedding multiple SVGs inline on one page, rename the `indigo` gradient ID per-file to avoid conflicts (e.g. `indigo-nav`, `indigo-hero`).

---

## 9. Quick CSS Variables (drop into your theme)

```css
:root {
  --brand-indigo-start: #4F46E5;
  --brand-indigo-end: #7C3AED;
  --brand-indigo-light: #A5B4FC;
  --brand-gold: #F59E0B;
  --brand-gold-bright: #FBBF24;
  --brand-gold-deep: #D97706;
  --brand-ink: #1E1B2E;
  --brand-near-black: #0F0F1A;
  --brand-gradient: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
}
```
