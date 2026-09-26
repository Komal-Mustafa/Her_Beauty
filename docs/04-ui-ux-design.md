# 04 · UI / UX Design
### Her Beauty (HB) — Pink · Gold · White design system

| | |
|---|---|
| Version | 1.0 · 2026-09-25 (replaces `design.md` v0.1 berry palette) |
| Theme | **White** base · **Pink** brand · **Gold** luxury accent |
| Read with | `03-app-web-flow.md` (journeys) |

---

## 1. Design principles

1. **Luxury through space** — lots of white, few elements, big product imagery.
2. **Pink leads, gold shines** — pink for action and brand, gold only for premium details (thin lines, badges, icons). Never both loud at once.
3. **Motion tells a story** — slow, smooth, cinematic; never bouncy.
4. **Trust is visible** — "Payment protected", seller badges, real reviews, clear delivery info on every buying screen.
5. **Mobile first, 3D second** — every 3D moment has a fast fallback.

**60 · 30 · 10 rule:** 60% white / soft blush surfaces · 30% pink (brand, actions, highlights) · 10% gold (premium accents).

## 2. Color palette

### 2.1 Core tokens (contrast checked against white `#FFFFFF`)

| Token | Hex | Contrast on white | Use for |
|---|---|---|---|
| **white** | `#FFFFFF` | – | Main page background, cards |
| **blush-50** | `#FFF5F9` | – | Soft section backgrounds |
| **pink-100** | `#FCE4EF` | – | Hover backgrounds, chips, selected rows |
| **pink-200** | `#F8BBD9` | 1.6 ❌ text | Decorative fills, gradients |
| **pink-400** | `#E75A9B` | 3.3 — large text/icons only | Highlights, focus ring, illustrations |
| **pink-600** ⭐ Primary | `#C2185B` | **5.9 ✅** | Buttons, links, prices, key headings |
| **pink-700** | `#AD1457` | **7.0 ✅** | Button hover/pressed, text on blush |
| **gold-300** | `#E9D18A` | ❌ text | Shimmer, gradient light |
| **gold-500** ⭐ Accent | `#D4AF37` | 2.1 — decoration only | Thin borders, dividers, stars, premium badges |
| **gold-600** | `#B8872E` | 3.2 — large text/icons only | Icons, outlines on white |
| **gold-800** | `#8A6420` | **5.4 ✅** | Gold-colored **text** (e.g. "Official Brand") |
| **ink-900** | `#2B1A22` | **16.5 ✅** | Body text, headings |
| **ink-500** | `#6B5560` | **6.8 ✅** | Secondary text |
| **ink-200** | `#E6DDE1` | – | Borders, dividers, input outlines |

Tested pairs: white text on `pink-600` = 5.9 ✅ · `ink-900` text on `gold-500` = 7.8 ✅ (gold buttons use dark text, **never white**).

### 2.2 Status colors
| Token | Hex | Use |
|---|---|---|
| success | `#1E8A5A` | Paid, delivered, released, approved |
| warning | `#B7791F` | Pending, held, under review |
| danger | `#C62839` | Error, rejected, dispute, cancel |
| info | `#3F6FB5` | In transit, tips |

### 2.3 Gradients
```css
--grad-pink:  linear-gradient(135deg, #FFF5F9 0%, #FCE4EF 45%, #F8BBD9 100%); /* hero light, plan cards */
--grad-gold:  linear-gradient(120deg, #B8872E 0%, #E9D18A 45%, #D4AF37 60%, #B8872E 100%); /* premium borders, Icon package */
--grad-rose:  linear-gradient(135deg, #C2185B 0%, #E75A9B 100%); /* CTA banners, hero title fill */
--shine:      linear-gradient(100deg, transparent 30%, rgba(255,255,255,.65) 50%, transparent 70%); /* gold shimmer sweep */
```

### 2.4 Dark sections (optional, hero/footer)
Background `#1E0F16` · surface `#2A1620` · text `#FFF5F9` · primary `#F48FB1` · accent `#E9D18A`.

### 2.5 Tailwind preset
```js
// packages/config/tailwind-preset.js
export default {
  theme: { extend: {
    colors: {
      white: '#FFFFFF',
      blush: { 50: '#FFF5F9' },
      pink:  { 100:'#FCE4EF', 200:'#F8BBD9', 400:'#E75A9B', 600:'#C2185B', 700:'#AD1457' },
      gold:  { 300:'#E9D18A', 500:'#D4AF37', 600:'#B8872E', 800:'#8A6420' },
      ink:   { 200:'#E6DDE1', 500:'#6B5560', 900:'#2B1A22' },
      success:'#1E8A5A', warning:'#B7791F', danger:'#C62839', info:'#3F6FB5',
    },
    fontFamily: {
      display: ['var(--font-playfair)', 'serif'],
      accent:  ['var(--font-cormorant)', 'serif'],
      sans:    ['var(--font-inter)', 'system-ui', 'sans-serif'],
    },
    borderRadius: { btn: '12px', card: '20px' },
    boxShadow: {
      soft: '0 8px 30px rgba(194,24,91,0.08)',
      lift: '0 16px 40px rgba(194,24,91,0.14)',
      gold: '0 0 0 1px rgba(212,175,55,0.6)',
    },
  } },
};
```

## 3. Typography

| Role | Font | Weight | Desktop / Mobile |
|---|---|---|---|
| Display (hero) | Playfair Display | 600 | 72 / 40 |
| H1 | Playfair Display | 600 | 56 / 34 |
| H2 | Playfair Display | 500 | 40 / 28 |
| H3 | Playfair Display | 500 | 28 / 22 |
| Eyebrow ("HER BEAUTY") | Cormorant Garamond, UPPERCASE, tracking 0.22em | 600 | 14 / 12 |
| Body | Inter | 400 | 16 / 15, line-height 1.6 |
| UI / buttons | Inter | 500–600 | 15 |
| Price | Inter, tabular numbers | 600 | 20 / 18, color pink-600 |
| Caption | Inter | 400 | 12 |

Max 2 weights per screen area; line length 60–75 characters.

## 4. Layout, spacing, shape

- Grid: 12 columns, max width 1280 (content) / 1440 (hero); gutters 24 desktop, 16 mobile.
- Spacing scale (8-pt): 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128.
- Radius: buttons/inputs 12 · cards 20 · pills 999 · **circles** for category icons & seller logos (echo round logo).
- Borders: 1px `ink-200` normal; 1px `gold-500` for premium cards; 2px `grad-gold` for Icon package.
- Shadows: soft pink-tinted (`shadow-soft`), lift on hover (`shadow-lift`).
- Breakpoints: 360 · 768 · 1024 · 1280 · 1536.

## 5. Components

| Component | Spec |
|---|---|
| **Primary button** | bg pink-600, text white, 48px high, radius 12; hover pink-700 + lift; focus ring 2px pink-400 offset 2 |
| **Gold button** (premium CTA) | bg grad-gold, text ink-900, shimmer sweep on hover |
| **Secondary button** | white bg, pink-600 text, 1px pink-600 border |
| **Ghost button** | transparent, ink-900 text, underline on hover |
| **Input** | white, 1px ink-200, radius 12, 48px; focus border pink-600 + ring pink-100; label always visible above |
| **Product card** | white, radius 20, 4:5 image on blush-50, hover: image zoom 1.04 + 2nd image; "3D" chip top-left (gold outline); shade dots; price pink-600; seller name ink-500 |
| **Badge** | Verified Seller (pink-100 bg, pink-700 text) · Official Brand (white bg, gold-800 text, gold border, crown icon) · Sponsored (ink-200 bg, ink-500 text) |
| **Shade picker** | 28px circles with hex fill; selected = 2px gold ring + name tooltip |
| **Trust strip** | 3 icons in gold-600: Payment protected · Verified sellers · Easy returns |
| **Order stepper** | Paid → Accepted → Shipped → In transit → Delivered; done pink-600, current pulsing pink-400, next ink-200 |
| **Wallet card** | Held (warning) · Available (success) · Paid out (ink-500), large numbers |
| **Plan / package card** | white; "Popular" ribbon pink; Luxe gold border; Icon = dark card + grad-gold border + shimmer |
| **Toast** | white, left color bar by status, auto-hide 5s |
| **Empty state** | line illustration in pink-200/gold-500, one sentence, one CTA |
| **Skeleton** | blush-50 blocks with soft shimmer |

## 6. Page designs

### 6.1 Home (from client sketch)
```
┌──────────────────────────────────────────────────────────────────┐
│ Announcement bar (pink-600, white text): Free delivery over 3,000  │
│ Header (white): HB logo · Search · Categories · ♡ · 🛒 · Account  │
├──────────────────────────────────────────────────────────────────┤
│              4D CINEMATIC HERO (white → blush → pink)               │
│  Scene 1  white canvas, gold line draws the HB logo, gold dust     │
│  Scene 2  pink lipstick + compact float, light sweep on gold metal │
│  Scene 3  "Her Beauty, Her Story" (Playfair, rose gradient text)   │
│  Scene 4  featured ad product lands center → [Shop now] (pink)     │
├────────┬───────────────────────────────────────────┬─────────────┤
│ LEFT   │ Shop by category (circles, gold ring hover) │ RIGHT       │
│ 3D     │ Trending now (carousel)                     │ VIDEO AD    │
│ DISPLAY│ Official brands (gold-bordered logos)       │ sticky,     │
│ AD     │ New arrivals                                │ muted loop  │
│ sticky │ Offer banner (grad-rose)                    │ "Sponsored" │
│ 240px  │ Reviews / trust strip                       │ 240px       │
└────────┴───────────────────────────────────────────┴─────────────┘
│ Footer: blush-50 bg, gold divider flourish, links, payment logos   │
```
Mobile: side panels become full-width cards (3D ad after categories, video ad after trending). Hero becomes 80vh with shorter scenes or a video on low-tier devices.

### 6.2 Product page
Left 60%: gallery tabs **Images | Video | 3D** (3D: drag rotate, pinch zoom, auto-rotate, "Reset view"). Right 40% (sticky): brand eyebrow, title, rating, price, shade picker (updates 3D color live), qty, **Add to cart** (pink) + ♡, delivery estimate by city, seller card with badge, trust strip. Below: description · how to use · ingredients · reviews with photos · more from seller · similar products.

### 6.3 Cart & checkout
Cart groups items **by seller** with each seller's shipping line. Checkout = 3 steps on one page (Address → Delivery → Payment) with sticky order summary. Payment options as large radio cards with logos: Card · JazzCash · Easypaisa · Bank/Raast · COD. "Payment protected until delivery" note in gold-800 with shield icon.

### 6.4 Order tracking
One card per seller parcel: stepper, courier + tracking number, timeline events, "I received it" button, delivery OTP display (when used), "Report a problem".

### 6.5 Seller portal
- **Login**: split screen — left grad-pink with slow 3D compact + 3 trust points; right white form.
- **Register wizard**: top progress bar (gold fill), step ① two big cards *Manufacturer* (crown, gold) / *Vendor* (bag, pink); autosave indicator; "Save & continue later".
- **Dashboard shell**: white sidebar with pink active item and gold left bar; top bar with plan badge + usage meter ("6 / 8 products").
- **Ads → Packages**: 4 cards Glow (white) · Radiance (blush, "Popular") · Luxe (gold border) · Icon (dark + gold shimmer, "1 seat left"); billing toggle; comparison table; "Where your ad appears" mini home mock highlighting slots.
- **Ad calendar**: month grid per slot; available white, yours pink-600, taken ink-200 striped, pending gold outline.

### 6.6 Admin panel
Same shell, denser tables, less decoration (white + ink, pink only for primary actions). Money actions in a red "Danger zone" card that needs a reason text.

## 7. Motion

| Token | Value | Use |
|---|---|---|
| `dur-fast` | 150ms | hover, press |
| `dur-base` | 250ms | dropdowns, toasts |
| `dur-slow` | 450ms | drawers, page transitions |
| `dur-cinema` | 800–1200ms | hero scenes only |
| `ease-soft` | `cubic-bezier(0.22, 1, 0.36, 1)` | default |

Only animate `transform` and `opacity`. Gold shimmer max once per hover. **`prefers-reduced-motion`**: no parallax, no autoplay, hero = still image, transitions = opacity only.

## 8. 3D art direction
- Materials: gold metal (`color #D4AF37, metalness 1, roughness 0.25, clearcoat 1`), pink lipstick bullet (`#C2185B`, roughness 0.45), glossy pink powder, white marble pedestal.
- Lighting: soft studio HDRI + one warm key light (slight gold tint) + pink rim light.
- Background: white → blush gradient; floating pink petals and gold dust (instanced, few).
- Camera: slow dolly, never spin fast; product always readable.

## 9. UX writing
- Buttons start with a verb: **Add to cart**, **Book shipment**, **Request payout**, **Join waitlist** (never "Submit" / "OK").
- Errors never blame: "We couldn't reach JazzCash. Your cart is safe — try again or pick another method."
- Friendly, confident, short. English v1; keep strings in i18n files for Urdu later.

## 10. Accessibility checklist
WCAG 2.1 AA contrast (use tokens above) · visible labels on all inputs · keyboard access for everything including 3D viewer (arrow keys rotate) · focus ring pink-400 · alt text for products · aria-label on 3D: "3D view of {name}, drag or use arrow keys to rotate" · pause control for hero and videos · touch targets ≥ 44px · no information by color alone (status also has icon + text).

## 11. Logo usage
Round HB logo on white. Monogram "HB" only below 64px (favicon, app icon). On pink or dark backgrounds use white + gold version. Clear space = height of "H". **Request SVG + transparent PNG from the client** (current file is a JPEG).

> Note: the logo itself uses a deeper berry-pink for "HB". Our UI primary `#C2185B` is a brighter pink so the site reads as **pink**, as requested, while staying readable. If the client wants an exact match to the logo, use `#8E1B4F` for headings only.
