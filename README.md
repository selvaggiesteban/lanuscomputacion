# Lanús Computación — E-Commerce Platform

[![Production](https://img.shields.io/badge/Production-lanuscomputacion.com-2563eb?style=flat-square&logo=cloudflare&logoColor=white)](https://lanuscomputacion.com)
[![Framework](https://img.shields.io/badge/Astro-v5-FF5D01?style=flat-square&logo=astro&logoColor=white)](https://astro.build)
[![React](https://img.shields.io/badge/React-v19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Pages_%2B_D1-F38020?style=flat-square&logo=cloudflare&logoColor=white)](https://pages.cloudflare.com)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](#license)

A full-stack, edge-native e-commerce platform built for a real retail business — combining product catalog management, B2B wholesale pricing, NFC-powered in-store engagement, and multi-channel messaging in a single deployment that runs entirely on Cloudflare's global edge network.

> **Live site:** [lanuscomputacion.com](https://lanuscomputacion.com)

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment & Secrets](#environment--secrets)
- [Database & Migrations](#database--migrations)
- [Performance & D1 Free-Tier Protection](#performance--d1-free-tier-protection)
- [Deployment](#deployment)
- [Background Workers & CLI Tools](#background-workers--cli-tools)
- [Monitoring](#monitoring)
- [Key Engineering Highlights](#key-engineering-highlights)
- [Professional Expertise](#professional-expertise)
- [Author](#author)
- [License](#license)

---

## Overview

This platform powers the online operations of a computer retail and services business in Lanús, Buenos Aires. It was designed around three principles:

1. **Edge-first performance** — Every request is served from Cloudflare's edge: server-side rendering with Astro, a middleware-driven edge cache for public pages, and a globally distributed CDN by default.
2. **Zero-ops infrastructure** — No servers to provision, patch, or scale. The entire stack (frontend, APIs, database, background jobs, CDN) runs on Cloudflare's free tier and is kept within its limits by design (see [Performance & D1 Free-Tier Protection](#performance--d1-free-tier-protection)).
3. **Business-ready features** — B2B wholesale rules, discount coupons, installment pricing, promotional campaigns, and offline-to-online NFC bridges out of the box.

## Architecture

```
                         ┌──────────────────────────────┐
                         │   Cloudflare CDN (Edge)      │
                         │   DDoS · WAF · SSL · Brotli  │
                         └──────────────┬───────────────┘
                                        │
             ┌──────────────────────────▼──────────────────────────┐
             │        Edge Cache Middleware (Cache API)            │
             │   Public pages cached at the edge (TTL 5 min)       │
             │   HIT = 0 D1 rows read · X-Cache header             │
             └──────────────────────────┬──────────────────────────┘
                                        │ cache miss
             ┌──────────────────────────▼──────────────────────────┐
             │     Cloudflare Pages Functions (Astro SSR)          │
             │   Astro v5 · React v19 islands · Tailwind           │
             │   Storefront + Admin + REST API routes              │
             └──────────────────────────┬──────────────────────────┘
                                        │ D1 binding (DB)
             ┌──────────────────────────▼──────────────────────────┐
             │            Cloudflare D1 (SQLite)                   │
             │   20+ tables · performance indexes · typed layer    │
             └──────────────────────────┬──────────────────────────┘
                                        │ Cron trigger (hourly)
             ┌──────────────────────────▼──────────────────────────┐
             │        sync-elit Worker (Cloudflare)                │
             │   ELIT supplier catalog sync · price recalculation  │
             └─────────────────────────────────────────────────────┘

   CI/CD:  GitHub (main) ──push──▶ Cloudflare Pages ──▶ Auto deploy
```

## Features

### Storefront

- **Product catalog** with hierarchical categories, real-time search, and faceted filtering (price, brand, availability)
- **Product detail pages** with SEO metadata, Schema.org markup, related products, and dollar-rate display
- **Offers/deals section** (`/ofertas`) driven by a real promotions engine (by product, category, or storewide, with date windows)
- **Shopping cart** persisted client-side with Mercado Pago checkout (server-side price recomputation on every order)
- **Customer accounts** — profile, order history, favorites, password reset, Google login

### B2B / Wholesale

- Category-level wholesale rules stored in the database (discount %, minimum quantity, per-category or default)
- Public wholesale price display with an approval-gated purchase path
- B2B account registration at `/b2b` with admin approval workflow (pending / approved / rejected)

### Promotions & Pricing

- Promotions engine: percentage discounts applied to a product, a category, or the whole store, with start/end windows
- Percentage discount coupons with usage limits and expiry
- Installment pricing display (cuotas sin interés) driven by store configuration
- Dollar-rate-aware price recalculation for imported goods

### NFC In-Store Engagement

- **20 programmable NTAG213 cards** mapped to landing pages (`/p/01` … `/p/20`)
- Scan analytics dashboard (per-card hit counts, 30-day rolling stats)
- QR fallback for devices without NFC
- Full admin CRUD for card targets, titles, colors, and activation state
- Programming guide at `/nfc/guia`

### Messaging & Communications

- Multi-channel message center: **WhatsApp, Telegram, Messenger, Email, SMS**
- Contact management with tags and subscription consent
- Reusable message templates with `{{variable}}` interpolation
- Outbound/inbound message log with delivery status tracking

### Administration

- Central dashboard with KPIs (orders, B2B pendings, revenue)
- Product, category, order, coupon, and promotion management
- Price monitoring board (cost vs. list vs. dollar rate)
- Store configuration (shipping thresholds, currency, installment settings)
- Full NFC and messaging module administration
- B2B rules editor and account approval panel

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | Astro v5 (server rendering + islands architecture) |
| UI interactivity | React v19 (scoped islands) |
| Styling | Tailwind CSS v3 with custom design tokens |
| Serverless APIs | Cloudflare Pages Functions (V8 isolates) |
| Edge caching | Middleware + Cloudflare Cache API (`X-Cache` HIT/MISS) |
| Database | Cloudflare D1 (SQLite at the edge) |
| Session storage | Cloudflare KV (Astro sessions) |
| CDN / Security | Cloudflare (DNS, SSL, DDoS, WAF) |
| Payments | Mercado Pago |
| Transactional email | Resend |
| Background jobs | Cloudflare Workers (hourly catalog sync, Workers AI) |
| CI/CD | GitHub → Cloudflare Pages (push-to-deploy) + GitHub Actions quota watchdog |
| Package management | npm |

## Project Structure

```
lanuscomputacion-repo/
├── frontend/                  # Astro app (storefront + admin + API)
│   ├── migrations/            # D1 SQL migrations (002–015)
│   ├── src/
│   │   ├── components/        # Astro components + React islands
│   │   ├── layouts/           # BaseLayout, admin layouts
│   │   ├── lib/               # d1.ts (typed query layer), auth, email, utils
│   │   ├── middleware.ts      # Admin auth + edge cache for public pages
│   │   └── pages/             # Routes: storefront, admin, REST API
│   ├── styles.css             # Tailwind entry + design tokens
│   ├── tailwind.config.mjs    # Custom color/typography system
│   ├── astro.config.mjs       # output: 'server', Cloudflare adapter
│   └── wrangler.jsonc         # Pages + D1 binding config
├── workers/
│   └── sync-elit/             # Hourly catalog sync Worker (cron, D1, AI)
├── backend/                   # Python catalog tooling (ELIT supplier, B2B calc)
├── .github/workflows/         # d1-quota-watch.yml (quota watchdog)
├── main.py                    # Python CLI entry point
├── DESIGN.md                  # Design system documentation
└── requirements.txt           # Python dependencies
```

## Getting Started

### Prerequisites

- Node.js 18+
- Wrangler CLI (`npm install -g wrangler`) and a Cloudflare account (free tier works)
- Python 3.10+ (only for the catalog CLI / supplier tooling)

### Local development

```bash
git clone https://github.com/selvaggiesteban/lanuscomputacion.git
cd lanuscomputacion/frontend
npm install

# Apply all migrations to a local D1 database (in order)
for f in migrations/*.sql; do
  npx wrangler d1 execute lanus-catalog --local --file "$f"
done

npm run dev
```

Open `http://localhost:4321`.

### npm scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Astro dev server (port 4321) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build |
| `npm run deploy` | Build + deploy to Cloudflare Pages (`lanuscomputacion` project) |

## Environment & Secrets

### Bindings

| Binding | Type | Where | Purpose |
|---|---|---|---|
| `DB` | D1 database | Pages + sync-elit | Catalog, orders, users, NFC, messaging |
| `SESSION` | KV namespace | Pages | Astro session storage |
| `AI` | Workers AI | sync-elit | Product data enrichment |
| `caches.default` | Cache API | Pages middleware | Edge cache for public pages |

### Secrets

| Name | Where | Purpose |
|---|---|---|
| `MP_ACCESS_TOKEN` | Pages secret | MercadoPago payment preferences |
| `JWT_SECRET` | Pages secret | Session/signature key (a dev fallback warns in logs if unset) |
| `RESEND_API_KEY` | Pages secret | Transactional email (register, reset, order updates) |
| `ELIT_USER_ID`, `ELIT_TOKEN` | sync-elit secrets | ELIT supplier API credentials |
| `CLOUDFLARE_API_TOKEN` | GitHub Actions secret | D1 quota watchdog (Analytics Read) |

```bash
# Pages secrets
npx wrangler pages secret put MP_ACCESS_TOKEN --project-name lanuscomputacion
npx wrangler pages secret put JWT_SECRET --project-name lanuscomputacion
npx wrangler pages secret put RESEND_API_KEY --project-name lanuscomputacion

# Worker secrets
cd workers/sync-elit
npx wrangler secret put ELIT_USER_ID
npx wrangler secret put ELIT_TOKEN
```

Never commit secrets — `.env.example` documents the variables expected by the Python tooling (R2, Mercado Pago public keys).

## Database & Migrations

Migrations live in `frontend/migrations/` and are applied **manually and in order** so schema changes stay deliberate and reviewable:

```bash
cd frontend
npx wrangler d1 execute lanus-catalog --remote --file=./migrations/<NNNN_name>.sql
```

| Migration | Purpose |
|---|---|
| 002–006 | Core schema: admin, B2B status, reviews, password reset, monitoring + promotions |
| 007 | Discount coupons |
| 008 | B2B rules moved to database |
| 009 | Store configuration |
| 010–011 | Performance indexes |
| 012 | NFC cards + scan analytics (20 NTAG213 seeds) |
| 013 | Messaging system (channels, contacts, templates) |
| 014 | Contact import (validated against enrichment rules) |
| 015 | Composite indexes for catalog hot paths (home, price, category) |

## Performance & D1 Free-Tier Protection

The platform is engineered to stay inside the D1 free tier (5M rows read per day) even under sustained traffic. Four layers cooperate:

### 1. Edge cache for public pages (middleware.ts)

Public pages are rendered once and then served from the Cloudflare edge — a cache HIT executes zero D1 queries:

| Route | TTL | Why |
|---|---|---|
| `/` (home) | 5 min | Highest-traffic page |
| `/ofertas` | 5 min | Promotions change rarely |
| `/categoria/*`, `/producto/*` | 5 min | Catalog freshness vs. cost |
| `/busqueda/*` | 2 min | Query strings vary |
| `/servicios*`, legal/info pages, `/b2b`, `/sitemap.xml` | 1 h | Nearly static |
| `/admin*`, `/api*`, `/p/*` (NFC), account/cart pages | never | Auth-sensitive, write-on-visit, or personalized |

Responses carry an `X-Cache: HIT | MISS` header for verification, and `Set-Cookie` responses are never cached.

### 2. Query-level optimizations

- Window-function counts (`COUNT(*) OVER()`) return rows and totals in a single pass — search and browse pages read half the rows.
- `/ofertas` pushes the promotion filter into SQL: with no active promotions the products query is skipped entirely; otherwise only promo-matching rows are read (capped at 500).
- Composite indexes (migrations 010, 011, 015) cover every hot query path: home ordering, price range scans, and category filters.

### 3. Schema discipline

Recursive category trees are fetched in one query instead of per-item lookups (N+1 elimination cut `rows_read` by roughly 90%), and all dynamic `IN` clauses are guarded against empty sets.

### 4. Automated quota watchdog

`.github/workflows/d1-quota-watch.yml` runs every 6 hours, queries the D1 Analytics GraphQL API for `rowsRead`, and fails loudly before the daily quota is exhausted:

- Warning threshold: 3.5M rows read today (70%)
- Critical threshold: 4.5M rows read today (90%)
- Also fails if yesterday finished above the 5M limit

Requires the `CLOUDFLARE_API_TOKEN` GitHub Actions secret (Analytics Read permission).

## Deployment

Deployment is fully automated:

1. Push to `main` on GitHub
2. Cloudflare Pages builds the Astro app (`astro build`, server output)
3. Functions deploy to 300+ edge locations worldwide
4. Previous deploys remain available for one-click rollback

Manual deploys are also supported:

```bash
cd frontend
npm run deploy          # astro build && wrangler pages deploy dist/ --project-name lanuscomputacion
```

Database migrations are applied manually via Wrangler (see above). The `sync-elit` Worker deploys independently:

```bash
cd workers/sync-elit
npm run deploy          # wrangler deploy (cron: 0 * * * *)
```

## Background Workers & CLI Tools

### sync-elit Worker (`workers/sync-elit`)

Runs every hour on a cron trigger:

- Pulls the product catalog from the ELIT supplier API (the configured provider)
- Normalizes products, seeds new categories, archives missing items
- Reads the dollar rate, applies the configured markup, and recalculates retail prices when the rate moves
- Writes to the same `lanus-catalog` D1 database used by the site

### Python CLI (`main.py`)

| Command | Description |
|---|---|
| `python main.py init` | Initialize the local database |
| `python main.py test-elit` | Test ELIT API connectivity |
| `python main.py import-elit [--limit N]` | Import ELIT products |
| `python main.py sync-elit` | Incremental sync (last 24 h) |
| `python main.py b2b calc` | Recalculate wholesale prices |
| `python main.py export [--format csv\|json]` | Export the catalog |
| `python main.py review list\|apply` | Manage the product review queue |
| `python main.py serve [--port 8000]` | Start the FastAPI server |
| `python main.py export-frontend` | Export DB to frontend JSON files |

## Monitoring

- **D1 quota watchdog** — GitHub Actions workflow alerting on `rowsRead` consumption (see [Performance](#performance--d1-free-tier-protection))
- **Edge cache headers** — `X-Cache: HIT/MISS` on every cached route for instant verification
- **NFC scan analytics** — per-card hit counts and rolling 30-day stats in the admin dashboard
- **Application logs** — structured `console.log`/`console.error` in Workers and Pages Functions, viewable in the Cloudflare dashboard

## Key Engineering Highlights

- **Edge-cached SSR** — The whole site renders server-side against D1, then public pages are parked at the edge; repeat visits and crawlers consume zero database quota.
- **N+1 query elimination** — Replaced ~82 per-item category queries with a single recursive tree query, cutting D1 `rows_read` by ~90%.
- **Typed data layer** — All routes go through a single `d1.ts` module with TypeScript types for every table.
- **Parameterized SQL everywhere** — Injection-safe queries; empty-set guards on dynamic `IN` clauses.
- **Server-side price integrity** — Checkout recomputes promotions and prices from the database; the client never dictates what it pays.
- **Graceful degradation** — Navigation and menus render from cached/fallback data even if the database is briefly unavailable.
- **Push-to-deploy** — Trunk-based delivery with one-click rollbacks and deliberate, manually applied schema migrations.

## Professional Expertise

This repository demonstrates end-to-end ownership of a production web platform:

- **Frontend engineering** — Modern component architecture (Astro islands + React), mobile-first design systems, accessibility-aware markup
- **Backend & API design** — Serverless REST endpoints, session auth, payment gateway integration
- **Database engineering** — Schema design, indexing strategy, query performance forensics on serverless SQLite (D1 free-tier budget management)
- **Cloud infrastructure** — Edge computing, Cache API, DNS, WAF, and zero-downtime deployments on Cloudflare
- **DevOps / CI-CD** — Git-driven trunk-based delivery with automated deploys and an analytics-based quota watchdog
- **Security** — Parameterized queries, TLS hardening, server-side price validation
- **Product thinking** — B2B pricing logic, promotions engine, and physical-to-digital NFC experiences

## Author

**Esteban Selvaggi** — Full-Stack Web Developer & IT Engineering student based in Buenos Aires, Argentina.

Specializations: high-performance web architecture · AI integration · process automation (RPA) · technical SEO.

With 8+ years of experience transforming complex business requirements into scalable, secure, and efficient software solutions.

- [selvaggiesteban.dev](https://selvaggiesteban.dev)
- [LinkedIn](https://www.linkedin.com/in/selvaggiesteban/)
- [selvaggiesteban@gmail.com](mailto:selvaggiesteban@gmail.com)

## License

This project is licensed under the MIT License.

---

© 2026 Esteban Selvaggi · Lanús Computación
