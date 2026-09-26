# 01 · PRD — Product Requirements Document
### Her Beauty (HB) — Premium Multi-Vendor Beauty Marketplace

| | |
|---|---|
| Version | **1.0** (replaces `prd.md` v0.1) |
| Date | 2026-09-25 |
| Status | Draft — waiting for client answers (§14) |
| Brand colors | **Pink · Gold · White** (see `04-ui-ux-design.md`) |
| Related docs | 02-TRD · 03-Flows · 04-UI/UX · 05-DB · 06-Plan · 07-Payments · 08-Website Docs · 09-Runbook |

> **[CONFIRM]** = my reading of the client sketch or a guess. Must be checked with the client.

---

## 1. Product in one paragraph

Her Beauty is a **premium online beauty mall**. Many **vendors** (shops that resell brands) and **manufacturers** (brands that make their own products) sell to customers in one place. The customer pays **Her Beauty**, Her Beauty **holds the money safely until the parcel is delivered**, then pays the seller. The site looks and feels like a luxury cosmetics launch film — a **"4D" cinematic 3D header**, a **3D product ad** on the left, a **video ad** on the right, and a **3D viewer** on product pages. Sellers pay for **selling plans** and can buy **advertising packages** to get seen.

## 2. Problem & opportunity

| Problem today | How Her Beauty solves it |
|---|---|
| Customers fear **fake beauty products** online | Verified sellers, **brand protection**, "Official Brand" badge for manufacturers |
| Customers fear **paying and not receiving** | Money held until delivery is proven (escrow-style) |
| Small beauty brands can't afford a premium website | Their products appear in a premium 3D store for a monthly plan |
| Brands have no targeted place to advertise to beauty buyers | Built-in ad packages: hero, 3D, video, banners, sponsored products |
| Many buyers still use COD / wallets, not cards | Local wallets (JazzCash, Easypaisa), cards, bank/Raast, COD |

## 3. Goals & success metrics (first 12 months) [CONFIRM targets]

| # | Goal | Metric | Target |
|---|---|---|---|
| G1 | Trust | Orders with dispute | < 3% |
| G2 | Seller growth | Approved sellers | 200 by month 6, 500 by month 12 |
| G3 | Sales | Monthly orders (GMV) | 5,000 orders/month by month 12 |
| G4 | Premium & fast | Mobile Lighthouse performance | ≥ 90 on home + product page |
| G5 | Revenue | Commission + plans + ads | Ads ≥ 25% of platform revenue |
| G6 | Conversion | Visitor → order | ≥ 2% |

## 4. Users & roles

| Role | Description | Main jobs |
|---|---|---|
| **Visitor / Customer** | Beauty shopper, mostly mobile | Discover, watch, view 3D, buy, track, review, return |
| **Vendor** | Reseller / distributor / shop | Sell authorized brands, ship own parcels, get paid |
| **Manufacturer** | Brand owner / factory | Sell own brand, **protect brand**, approve distributors, advertise |
| **Seller staff** | Employee of a seller | Manage products/orders with limited rights |
| **Admin** | Platform owner (client) | Approve sellers, money, disputes, ads, content |
| **Support agent** | Platform staff | Tickets, order help, refunds (limited rights) |
| **Finance** | Platform staff | Payouts, reconciliation, invoices |

## 5. Personas (short)

- **Ayesha, 24, student (customer)** — shops on phone, uses JazzCash, afraid of fakes, loves video reviews.
- **Sana, 38, working mom (customer)** — pays by card, wants fast delivery and genuine skincare.
- **"Glow Cosmetics" (manufacturer)** — local lipstick brand, wants premium image + to stop fake copies.
- **"Beauty Point" (vendor)** — shop with 300 products from 20 brands, has its own courier account.

## 6. Scope

### 6.1 In scope (MVP / version 1)
Storefront with 3D/4D experience · customer accounts · multi-vendor cart & checkout · online payment + COD · escrow-style hold & release · vendor-provided shipping integration · seller registration (vendor/manufacturer) · brand protection · selling plans · ad packages & ad serving · seller dashboard · admin panel · reviews · returns/disputes · notifications (email/SMS/WhatsApp [CONFIRM]).

### 6.2 Out of scope (v1)
Native mobile apps · AR virtual try-on · platform-owned warehouse/delivery fleet · loyalty points · live-stream shopping · multi-language beyond English (Urdu in v2) · marketplace outside Pakistan (v2, see §10).

## 7. Feature requirements

Priority: **P0** = must for launch · **P1** = should for launch · **P2** = after launch.

### 7.1 Storefront & discovery
| ID | Requirement | Priority |
|---|---|---|
| F-ST-01 | Home page: **4D cinematic hero** (scroll-driven 3D story: brand → beauty → featured ad) | P0 |
| F-ST-02 | **Left sticky 3D display ad** and **right sticky video ad** on desktop; become in-feed cards on mobile | P0 |
| F-ST-03 | Category circles, trending, new arrivals, top brands, offers | P0 |
| F-ST-04 | Search with typo tolerance + filters (brand, category, price, skin type, shade, rating, seller type) | P0 |
| F-ST-05 | Product page: images, video, **3D viewer**, shade picker (3D color changes live), reviews, seller info, delivery estimate | P0 |
| F-ST-06 | Seller store page with badge (Verified Seller / Official Brand) | P0 |
| F-ST-07 | Weak phones / reduced motion get video/image fallback instead of 3D | P0 |
| F-ST-08 | Wishlist, recently viewed | P1 |
| F-ST-09 | AI beauty assistant (shade finder, skin routine) | P2 |

### 7.2 Customer account, cart & checkout
| ID | Requirement | Priority |
|---|---|---|
| F-CU-01 | Sign up / login with email or phone OTP; Google login | P0 |
| F-CU-02 | Guest checkout with phone OTP [CONFIRM] | P1 |
| F-CU-03 | One cart with items from many sellers; shipping shown **per seller** | P0 |
| F-CU-04 | Address book with city/area; COD eligibility check | P0 |
| F-CU-05 | Pay by card, JazzCash, Easypaisa, bank/Raast, or COD | P0 |
| F-CU-06 | Order page with one tracking timeline **per seller parcel** | P0 |
| F-CU-07 | "I received my order" button + delivery OTP | P0 |
| F-CU-08 | Return / "problem with order" within return window with photos | P0 |
| F-CU-09 | Review only after delivery (verified purchase) | P0 |

### 7.3 Seller onboarding (vendor & manufacturer)
| ID | Requirement | Priority |
|---|---|---|
| F-SO-01 | Seller portal login, 2FA, forgot password, OTP verify | P0 |
| F-SO-02 | 9-step registration wizard, choose **Vendor** or **Manufacturer**, save & continue later | P0 |
| F-SO-03 | Manufacturer details: brands, trademark, factory, licence, certifications | P0 |
| F-SO-04 | Vendor details: brands sold + authorization letters | P0 |
| F-SO-05 | Admin review: approve / request changes / reject with reason | P0 |
| F-SO-06 | **Brand protection**: protected brand can be listed by others only with approved authorization | P0 |
| F-SO-07 | Seller staff accounts with roles | P1 |

### 7.4 Seller operations
| ID | Requirement | Priority |
|---|---|---|
| F-SE-01 | Product manager: variants/shades, stock, images, video, 3D (.glb) | P0 |
| F-SE-02 | Plan limits enforced (e.g. Standard = 8 products) | P0 |
| F-SE-03 | Orders: accept, pack, book shipment on **own courier** or enter tracking | P0 |
| F-SE-04 | Shipping settings: courier account connection, rates by zone/weight, free-shipping threshold | P0 |
| F-SE-05 | Wallet: Held / Available / Paid out; payout request | P0 |
| F-SE-06 | Analytics: sales, views, conversion; ad stats | P1 |
| F-SE-07 | Bulk product upload (CSV) | P1 |

### 7.5 Selling plans [CONFIRM prices/limits]
| Feature | Standard | Business | Enterprise |
|---|---|---|---|
| Price / month (PKR) | 2,500 | 7,500 | 20,000 |
| Products | 8 | 50 | Unlimited |
| Images per product | 5 | 10 | 15 |
| Product video | ✗ | ✓ | ✓ |
| 3D model | ✗ | ✗ | ✓ |
| Staff logins | 1 | 3 | 10 |
| Commission | 15% | 12% | 10% |
| Analytics | Basic | Standard | Advanced |
| Ad package discount | – | 5% | 10% |

### 7.6 Advertising packages (separate monthly subscription) [CONFIRM]
| | **Glow** | **Radiance** | **Luxe** | **Icon** |
|---|---|---|---|---|
| Price / month (PKR) | 15,000 | 40,000 | 90,000 | 200,000 |
| Sponsored products | 3 | 10 | 25 | Unlimited |
| Guaranteed impressions | 20,000 | 75,000 | 200,000 | 500,000 |
| Category banner | ✗ | 7 days | 14 days | 30 days |
| Right video ad | ✗ | 7 days | 14 days | 30 days |
| Left 3D display ad | ✗ | ✗ | 14 days | 30 days |
| 4D cinematic hero scene | ✗ | ✗ | ✗ | 30 days |
| Featured brand on home | ✗ | ✗ | ✓ | ✓ top |
| Seats | Unlimited | 20 | 8 | 3 |

Billing monthly / quarterly (−10%) / yearly (−20%); waitlist when seats are full; creatives approved by admin; every ad shows **"Sponsored"**.

### 7.7 Shipping (provided by each seller)
- Mode A **Connected courier**: seller links its own courier account (API key); booking, labels and tracking inside Her Beauty.
- Mode B **Own delivery / other courier**: seller enters tracking; customer confirms with **delivery OTP**.
- Seller sets its own rates; seller is responsible for loss/damage.
- **Seller "mark delivered" alone never releases money.**

### 7.8 Money rules
1. Customer pays **Her Beauty** (not the seller).
2. Each order is split into **seller orders**.
3. Money status: `held → releasable → released → paid_out` (or `refunded`).
4. Release = **delivery proven + return window (7 days) passed + no open dispute**.
5. Seller receives: item total + shipping fee − commission − payment fee share [CONFIRM fee share].
6. **COD**: seller's courier collects cash → seller; platform charges commission to seller wallet / monthly invoice.
7. New sellers: 14-day hold for first 20 orders.
8. Payout: weekly automatic or on request (min PKR 1,000) [CONFIRM].

### 7.9 Admin
Seller applications · brands & authorizations · products moderation · orders & disputes · refunds · payouts · reconciliation · plans & ad packages · ad creative approval & slot calendar · hero content · categories · CMS pages · users & roles · settings (commission, return window) · audit log.

## 8. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | LCP < 2.5s (4G mid phone), INP < 200ms, CLS < 0.05; API p95 < 300ms |
| Availability | 99.5% monthly (v1) |
| Scale (v1) | 500 sellers, 50k products, 5k orders/day, 2k concurrent visitors |
| Security | OWASP Top 10, no card data stored (PCI SAQ-A), 2FA for admin/seller payouts (see `security.md`) |
| Privacy | Data minimisation, customer can export/delete data |
| Accessibility | WCAG 2.1 AA |
| SEO | SSR product/category pages, schema.org Product, sitemap |
| Devices | Mobile-first; 360px → 1920px; 3D fallback for weak devices |
| Localization | English v1; PKR v1; USD/other currencies v2 |

## 9. Business model

| Revenue stream | How |
|---|---|
| Commission | % of each sale by plan (10–15%) |
| Selling plans | Monthly subscription |
| Ad packages | Monthly subscription + add-ons |
| 3D service (optional) | Paid 3D model creation for sellers [CONFIRM] |

## 10. International (phase 2)
Same site, second payment route (see `07-payment-gateway.md`): international cards through an international processor, prices shown in USD, sellers opt-in to international shipping. Requires a legal entity/processor that supports the target countries **[CONFIRM business structure]**.

## 11. Assumptions
Market Pakistan first (PKR, English) · COD needed · 7-day return window · sellers ship themselves · the ChatGPT planning chat could not be read, so anything only in that chat is missing.

## 12. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Gateway won't allow marketplace holding funds | Blocks escrow model | Confirm with gateway/bank before build (Phase 0) |
| Counterfeit products | Trust loss | Brand protection, reviews, strikes |
| 3D slows the site | Lost sales | Performance budget, device tiers, fallbacks |
| COD refusals | Seller losses | COD limits, OTP-verified phone, refusal tracking |
| Few sellers at launch | Empty store | Onboard 20–30 pilot sellers before launch |

## 13. Release plan
MVP (all P0) → soft launch with pilot sellers → public launch → v1.1 (P1) → v2 (international, Urdu, AI assistant).

## 14. Open questions for the client
1. Confirm Pakistan-first and when international is needed.
2. Plan prices, product limits, commission %.
3. Ad package prices, seats, add-ons.
4. COD: all cities or some? COD limit per order?
5. Return window and who pays return shipping.
6. Regulator documents (e.g. DRAP) mandatory for which sellers?
7. Who provides the hero "4D" content — client video or we build 3D scenes?
8. 3D model service offered by the platform?
9. Notification channels: SMS, WhatsApp, email?
10. Anything agreed in the ChatGPT chat that is not in these docs (please paste it).
