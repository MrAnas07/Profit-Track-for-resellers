<div align="center">

# ProfitTrack

**A cloud-first profit book for WhatsApp resellers**

Price options · Per-option history · One-tap WhatsApp-ready share text

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.3-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white)](https://neon.tech)
[![Clerk](https://img.shields.io/badge/Auth-Clerk-6C47FF)](https://clerk.com)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps)

</div>

---

## Overview

ProfitTrack is a multi-user web application built for people who buy and sell through WhatsApp supplier groups. It tracks every purchase as a product with **one or more price options**, keeps a **history of each price change**, computes investment and profit automatically, and turns any product into a **perfectly formatted WhatsApp message** in one tap.

Unlike spreadsheet-style trackers, ProfitTrack understands the reseller workflow end to end — from receiving a supplier's forwarded WhatsApp message (paste it and the cost prices are extracted automatically) to sharing an updated price list with customers using your current sell prices.

Every account is isolated: sign in, and you see only your own suppliers, categories, products and history — synced to your account across devices.

---

## Features

### Core tracking
- **Dashboard** — total investment, expected profit, available/sold units and realized profit at a glance, plus a recent-products feed
- **Products** — name, details, quantity, status (Available / Pending / Sold), supplier group and category
- **Price options** — multiple variants per product (e.g. *Standard* / *With Organizer Box*); lists show `From Rs. X` with a `+N more` hint; all metrics sum across every option
- **Price history** — every cost or sell price edit is recorded per option with a timestamp; the edit dialog shows the running timeline
- **Supplier groups** — your WhatsApp buying groups; deleting one is safely blocked while products still reference it
- **Categories** — six sensible defaults seeded on first use; deleting one detaches products cleanly

### WhatsApp workflow
- **Share format** — one tap copies a clean, emoji-formatted price message (see below) and offers a direct WhatsApp deep link
- **Paste from WhatsApp** — paste a supplier message and ProfitTrack extracts the product name, details and **cost prices** into the form; sell prices stay blank for you to fill
- **Smart rebuild** — the original message is stored with the product; later shares re-emit your original text with **current sell prices** substituted (falling back to the standard template)

### Data & backup
- **JSON backup / restore** — full-fidelity export (including original messages and price options) and one-click restore
- **CSV export** — spreadsheet-ready, with per-option columns
- **Migrate local data** — one-time migration of data from the app's previous offline IndexedDB store into the cloud account
- **Danger zone** — reset every product, group and category of the account

### Experience
- **Fully responsive** — card layout on phones, compact tablet grid, clean data table on desktop
- **Light / Dark / System** themes with a polished toggle
- **Collapsible sidebar** (desktop) and slide-in navigation sheet (mobile)
- **Global search** + supplier/category filters + status chips
- **Loading skeletons, empty states and toasts** throughout
- **Installable PWA** with icons, manifest and offline shell
- **Touch-friendly** — all interactive controls meet minimum target sizes on every breakpoint

---

## WhatsApp Share Format

The exact template ProfitTrack copies to the clipboard — prices are rendered per option, and blank option names fall back to `Standard`:

```handlebars
✨ *{{product.name}}*

{{#each priceOptions}}
💎 {{name}} → *Rs. {{sellPrice}}*
{{/each}}

📝 {{product.details}}
```

Example output:

```text
✨ *Samsung A15 128GB*

💎 Standard → *Rs. 47,500*
💎 With Organizer Box → *Rs. 49,000*

📝 Black, PTA approved, 1 year warranty
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, Turbopack) · React 19 |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS v4 · shadcn/ui v4 on Radix primitives · CVA |
| Authentication | Clerk — sign-in/sign-up, `UserButton`, middleware-protected routes |
| Database | Neon PostgreSQL · Prisma 7 with the `pg` driver adapter |
| Data layer | Server actions returning typed `ActionResult<T>` · React context provider |
| Animation | `motion` (`motion/react`), reduced-motion aware |
| PWA | `@ducanh2912/next-pwa` — manifest, icons, service worker |
| Legacy local store | Dexie (IndexedDB) — read only, for one-time migration |
| QA | Playwright smoke suite · responsive layout audit · screenshot automation |
| Lint / Types | ESLint 9 (`eslint-config-next`) · `tsc --noEmit` |

---

## Data Model

Six tables, **every one scoped by `userId`**:

```text
User ─────────┬────────────────────────────┐
              │                            │
     SupplierGroup                        Category
        │  (Restrict on delete)    (SetNull on delete)
        │         \                  /
        │          \                /
        └────────► Product ◄────────┘
                      │
                 PriceOption  (name, costPrice, sellPrice, sortOrder)
                      │
                 PriceHistory (per-option old/new cost & sell + timestamp)
```

- **User** — mirrored from the Clerk user ID; auto-created on first sign-in
- **SupplierGroup / Category** — per-user masters
- **Product** — references a group (required) and a category (optional); also stores `originalMessage` for share rebuilds
- **PriceOption** — array order defines presentation order (`sortOrder`)
- **PriceHistory** — written only when an option's cost/sell value actually changes

---

## Security & Multi-tenancy

- All routes behind Clerk middleware (`auth.protect()`); only sign-in/sign-up are public
- **Every query and mutation is filtered by the authenticated `userId`**, with explicit ownership resolution on referenced records
- Server actions never throw raw errors — they return typed results so production responses stay opaque
- Secrets live only in environment variables (`.env` is gitignored; `.env.example` documents the required keys with placeholders)
- Backup/restore and reset operations are account-scoped server actions, not client trusts

---

## Architecture

```text
app/
├── (auth)/            Sign-in & sign-up (Clerk, branded layout)
└── (app)/             Authenticated shell
    ├── layout.tsx     AppShell + DataProvider + ProductDialog
    ├── page.tsx       Dashboard
    ├── products/      List, filters, table/card views
    ├── suppliers/     Supplier group CRUD
    ├── categories/    Category CRUD
    └── settings/      Appearance, backup, restore, migrate, danger zone

components/
├── layout/            Header, sidebar, sheet nav, theme toggle
├── dashboard/         Metrics + recent products
├── products/          List, filters, dialog, share button, badges
├── suppliers|categories|settings/
├── providers/         DataProvider (cloud state), dialog + toaster
├── shared/            PageHeader, EmptyState, skeletons
└── ui/                shadcn components (button, dialog, table, …)

lib/
├── actions.ts         All server actions (Clerk + userId scoped)
├── prisma.ts          Prisma client singleton
├── share.ts           Share template builder + WhatsApp link
├── extract.ts         Paste-from-WhatsApp parser
├── export.ts          CSV/backup build, parse + normalize (pure)
└── price.ts|format.ts Price labels, profit math, money formatting

prisma/schema.prisma   6-table schema
scripts/               Smoke suite, layout audit, screenshot tooling
```

**Key decisions**

- *Server actions are the single data path* — no client directly touches the database; every mutation refreshes the provider so UI, metrics and counts stay consistent
- *Array order is the presentation order* — options and history are replaced wholesale on save, keeping client-side diffing and server writes simple and race-safe
- *Seeding is idempotent* — default categories appear on first load and after a full reset
- *Online-first* — the PWA shell installs and launches offline; live data syncs when connected, and the UI degrades gracefully instead of blanking

---

## Quality Assurance

| Suite | What it proves |
|---|---|
| **Smoke tests** (`npm run smoke`) | 50+ checks: auth gate, session, cloud reset, seeded categories, supplier/product CRUD, metric math across options, exact WhatsApp share template, paste-extract → save → rebuild-with-new-prices, search & filters, status chips, price history, CSV, backup/restore fidelity, dark mode, PWA manifest & service worker, offline navigation, mobile sheet & card layout |
| **Layout audit** (`scripts/layout-audit.mjs`) | 16 responsive checks: metric/settings grid columns per breakpoint, ≥36px touch targets, zero horizontal overflow on all pages at 375px, dialog footer/content separation, dark-mode toggle, input/select heights, nav item sizes |
| **Screenshot automation** (`scripts/shots.mjs`, `scripts/review-shots.mjs`) | Deterministic captures at mobile/tablet/desktop in both themes, plus a full-page review pass with overflow + small-target reporting |
| **Static gates** | `tsc --noEmit` and `eslint` both run clean |

---

## Roadmap

- [ ] Product images (Uploadthing)
- [ ] Aggressive client caching with React Query + offline write queue
- [ ] Sales analytics — profit trends, best sellers, supplier performance
- [ ] Supplier statements & running balances
- [ ] Share directly to WhatsApp (not just copy / deep link)
- [ ] Role-based team accounts for small reselling teams

---

## Contributing

Issues and pull requests are welcome. Please keep the existing conventions:

1. All data access through server actions in `lib/actions.ts`, always `userId`-scoped
2. New features must extend the smoke suite
3. `tsc --noEmit` and `eslint` must stay clean
4. UI changes should be verified at **375 / 768 / 1280** widths in both themes

---

<div align="center">

**ProfitTrack** — track every rupee, share every price ✨

</div>
