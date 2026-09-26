# 03 · App & Web Flow
### Her Beauty (HB) Marketplace — user journeys, screens and system flows

| | |
|---|---|
| Version | 1.0 · 2026-09-25 |
| Read with | `01-prd.md` (features), `04-ui-ux-design.md` (screens) |

Diagrams use **Mermaid** (GitHub, VS Code and most Markdown viewers draw them automatically).

---

## 1. Site map

```mermaid
flowchart TD
  subgraph WEB["herbeauty.pk — Customer site"]
    H[Home<br/>4D hero · 3D ad · video ad] --> CAT[Category]
    H --> SR[Search results]
    H --> BR[Brand page]
    CAT --> PDP[Product page<br/>images · video · 3D]
    SR --> PDP
    BR --> PDP
    PDP --> ST[Seller store]
    PDP --> CART[Cart]
    CART --> CO[Checkout]
    CO --> PAYG[Payment gateway page]
    PAYG --> OK[Order success]
    OK --> ORD[My orders · Tracking]
    ORD --> RET[Return / Problem]
    ORD --> REV[Write review]
    H --> ACC[Account · Addresses · Wishlist]
    H --> ADV[/advertise — for brands/]
    H --> INFO[About · FAQ · Policies · Contact]
  end
  subgraph SELLER["seller.herbeauty.pk — Seller portal"]
    SL[Login / 2FA] --> SD[Dashboard]
    SRG[Register wizard] --> SAS[Application status] --> SD
    SD --> SP[Products] & SO[Orders] & SSH[Shipping] & SW[Wallet] & SPL[Plan] & SA[Ads] & SS[Settings · Staff]
  end
  subgraph ADMIN["admin.herbeauty.pk — Admin"]
    AL[Login + 2FA] --> AD[Overview]
    AD --> AAP[Seller applications] & ABR[Brands] & APR[Products] & AOR[Orders] & ADI[Disputes] & APO[Payouts] & ARC[Reconciliation] & AAD[Ads] & ACM[CMS · Hero] & AST[Settings] & AAU[Audit log]
  end
  ADV --> SRG
```

## 2. Customer journeys

### 2.1 Discover → buy (online payment)
```mermaid
flowchart LR
  A[Land on Home] --> B[Scroll 4D hero]
  B --> C{Interested?}
  C -->|Hero ad| PDP
  C -->|Browse| D[Category / Search]
  D --> PDP[Product page]
  PDP --> E[Rotate 3D · pick shade]
  E --> F[Add to cart]
  F --> G[Cart: items grouped by seller]
  G --> H{Logged in?}
  H -->|No| I[Phone OTP / login]
  H -->|Yes| J[Checkout]
  I --> J
  J --> K[Address → shipping per seller]
  K --> L[Choose payment: Card / JazzCash / Easypaisa / Bank-Raast / COD]
  L -->|Online| M[Redirect to gateway]
  M --> N{Paid?}
  N -->|Yes, webhook verified| O[Order success + email/SMS]
  N -->|No / cancelled| P[Back to checkout, cart kept]
  L -->|COD| Q[OTP confirm phone] --> O
```

### 2.2 After purchase → delivery → money release
```mermaid
sequenceDiagram
  actor Cu as Customer
  participant HB as Her Beauty
  actor Se as Seller
  participant Co as Seller's courier
  Cu->>HB: Pays order (money HELD)
  HB->>Se: New order notification
  Se->>HB: Accept order
  Se->>HB: Book shipment (own courier via API) or enter tracking
  HB->>Co: Create booking with seller's credentials
  Co-->>HB: Tracking number + label
  HB->>Cu: "Shipped" + tracking link
  loop Tracking updates
    Co-->>HB: Webhook / polled status
    HB-->>Cu: Status on order page
  end
  Co-->>HB: Delivered (or customer gives delivery OTP / taps "Received")
  HB->>HB: Start 7-day return window
  alt No problem reported
    HB->>Se: Release money to wallet (minus commission)
    Se->>HB: Request payout → bank
  else Customer opens return/dispute
    HB->>HB: Freeze money → admin decides → release or refund
  end
```

### 2.3 Return / dispute
```mermaid
flowchart TD
  A[Order delivered] --> B{Within return window?}
  B -->|No| X[Show 'Contact support']
  B -->|Yes| C[Customer: reason + photos]
  C --> D[Money frozen]
  D --> E{Seller response in 48h}
  E -->|Accepts return| F[Customer ships back / pickup] --> G[Seller confirms received] --> R[Refund customer]
  E -->|Offers partial refund| H{Customer agrees?}
  H -->|Yes| R2[Partial refund + release rest]
  H -->|No| I[Admin review]
  E -->|No answer / rejects| I
  I -->|Customer right| R
  I -->|Seller right| S[Release to seller]
```

### 2.4 Account
Sign up (email/phone + OTP) → profile → addresses → wishlist → order history → review → notification settings → download / delete my data.

## 3. Seller journeys

### 3.1 Registration (vendor or manufacturer)
```mermaid
flowchart TD
  A[/advertise or 'Become a seller'/] --> B[① Choose: Manufacturer or Vendor]
  B --> C[② Account: name, email, mobile, password + OTP]
  C --> D[③ Business: legal name, store name, NTN/SECP, address]
  D --> E{Type?}
  E -->|Manufacturer| F[④a Brands, trademark, factory, licence, certifications]
  E -->|Vendor| G[④b Brands sold + authorization letters]
  F --> H[⑤ Documents: ID, selfie, business papers]
  G --> H
  H --> I[⑥ Bank account — can skip]
  I --> J[⑦ Shipping mode + pickup address — can skip]
  J --> K[⑧ Choose selling plan]
  K --> L[⑨ Review & submit]
  L --> M[Status: Under review]
  M --> N{Admin decision}
  N -->|Changes needed| O[Fix listed fields] --> M
  N -->|Rejected| P[Reason + appeal link]
  N -->|Approved| Q[Pay plan → Dashboard → add products]
```

### 3.2 List a product
Products → New → title, brand (protected brand? → needs approved authorization) → category → variants/shades (hex color) → price & stock → images / video / 3D (plan-limited) → description (rich text, sanitized) → Save draft or Submit → admin moderation (first 10 products of new sellers) → Live → indexed in search.

### 3.3 Fulfil an order
```mermaid
flowchart LR
  A[New order alert] --> B[Accept within 24h]
  B --> C[Pack]
  C --> D{Shipping mode}
  D -->|Connected courier| E[Book in dashboard → print label]
  D -->|Own delivery| F[Enter tracking / rider → OTP sent to customer]
  E --> G[Shipped]
  F --> G
  G --> H[Auto tracking updates]
  H --> I[Delivered with proof]
  I --> J[Wallet: Held → Available after 7 days]
```
If not accepted in 24 h → reminder; 48 h → auto-cancel + refund + seller strike.

### 3.4 Buy an ad package
```mermaid
flowchart LR
  A[Ads → Packages] --> B{Seats left?}
  B -->|No| W[Join waitlist]
  B -->|Yes| C[Pick package + billing cycle]
  C --> D[Pick products to promote]
  D --> E[Book slot days on calendar]
  E --> F[Upload creatives per slot]
  F --> G[Review price]
  G --> H[Pay via gateway]
  H --> I[Creatives under admin review]
  I -->|Approved| J[Live on booked days]
  I -->|Rejected| K[Fix creative] --> I
  J --> L[Stats: impressions, clicks, orders]
```

### 3.5 Get paid
Wallet shows **Held / Available / Paid out** → weekly auto payout or "Request payout" (2FA) → admin/finance approves (4-eyes above limit) → bank transfer → marked paid → payout statement PDF.

## 4. Admin journeys
- **Approve seller**: queue → open application → view docs (logged) → checklist → approve / changes / reject.
- **Brand authorization**: request → manufacturer approves (or admin if no manufacturer on platform).
- **Dispute**: open case → evidence from both → decision → refund or release (reason required, audit logged).
- **Payout run**: review list → approve → export bank file / API → mark paid.
- **Daily reconciliation**: check report → mismatches → investigate → resolve.
- **Hero / ads**: approve creatives → manage calendar → set hero scene order.

## 5. System flow: online payment (technical)
```mermaid
sequenceDiagram
  participant B as Browser
  participant W as Next.js
  participant A as API
  participant G as Gateway
  participant Q as Worker
  B->>W: Place order
  W->>A: POST /orders (Idempotency-Key)
  A->>A: Recalculate prices, reserve stock, create order + seller_orders
  A->>G: Create payment session (amount from DB)
  G-->>A: redirect URL
  A-->>B: Redirect to gateway
  B->>G: Pays
  G-->>B: Redirect to /orders/:id/return (shows "confirming…")
  G->>A: Webhook (signed)
  A->>A: Verify signature, dedupe event_id, enqueue
  Q->>G: GET payment status (double-check)
  Q->>Q: Amount/currency match → mark paid, ledger entries, notify
  B->>W: Poll order status → "Paid ✓"
```

## 6. Notifications map

| Event | Customer | Seller | Admin |
|---|---|---|---|
| Order paid / COD placed | Email + SMS | Dashboard + SMS | – |
| Seller accepted | In-app | – | – |
| Shipped | SMS + email with tracking | – | – |
| Out for delivery (OTP mode) | SMS with delivery OTP | – | – |
| Delivered | Email: review request | Dashboard | – |
| Return/dispute opened | Email | SMS + dashboard | Queue |
| Money released | – | Email | – |
| Payout paid | – | Email + SMS | – |
| Application status change | – | Email | – |
| Ad creative approved/rejected | – | Email | – |
| Reconciliation mismatch | – | – | Alert |

## 7. Empty, error and edge states (must design)
Empty cart · no search results (suggest categories) · product out of stock (notify me) · seller on holiday · payment failed / cancelled · payment pending (webhook late) · courier API down (manual tracking fallback) · 3D not supported (image fallback) · plan limit reached (upgrade CTA) · ad seats sold out (waitlist) · application rejected · session expired · offline.
