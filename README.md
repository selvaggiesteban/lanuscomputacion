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
- [Database & Migrations](#database--migrations)
- [Deployment](#deployment)
- [Key Engineering Highlights](#key-engineering-highlights)
- [Professional Expertise](#professional-expertise)
- [Author](#author)

---

## Overview

This platform powers the online operations of a computer retail and services business. It was designed around three principles:

1. **Edge-first performance** — Static generation where possible, server-side logic only where necessary, and a globally distributed CDN by default.
2. **Zero-ops infrastructure** — No servers to provision, patch, or scale. The entire stack (frontend, APIs, database, CDN) lives on Cloudflare's free tier.
3. **Business-ready features** — B2B wholesale rules, discount coupons, installment pricing, promotional campaigns, and offline-to-online NFC bridges out of the box.

## Architecture

```
                         ┌──────────────────────────────┐
                         │   Cloudflare CDN (Edge)      │
                         │   DDoS · WAF · SSL · Brotli  │
                         └──────────────┬───────────────┘
                                        │
                 ┌──────────────────────▼──────────────────────┐
                 │         Cloudflare Pages (SSG)              │
                 │   Astro v5 · React v19 islands · Tailwind   │
                 └──────────────────────┬──────────────────────┘
                                        │ Pages Functions
                 ┌──────────────────────▼──────────────────────┐
                 │        Serverless API Layer (JS/TS)         │
                 │   NFC · Messaging · Auth · Checkout hooks   │
                 └──────────────────────┬──────────────────────┘
                                        │ D1 binding
                 ┌──────────────────────▼──────────────────────┐
                 │        Cloudflare D1 (SQLite)               │
                 │   21 tables · indexed · 15 perf. indexes    │
                 └──────────────────────┬──────────────────────┘
                                        │ Cron trigger (hourly)
                 ┌──────────────────────▼──────────────────────┐
                 │      Catalog Sync Worker (Cloudflare)       │
                 │   External price/source reconciliation      │
                 └─────────────────────────────────────────────┘

   CI/CD:  GitHub (main) ──push──▶ Cloudflare Pages ──▶ Auto deploy
```

## Features

### Storefront
- **Product catalog** with hierarchical categories, real-time search, and faceted filtering (price, brand, availability)
- **Product detail pages** optimized for SEO with static generation
- **Offers/deals section** with promotional pricing and countdown logic
- **Shopping cart** with session persistence and Mercado Pago checkout integration
- **Customer accounts** — profile, order history, favorites, and notifications

### B2B / Wholesale
- Category-level wholesale rules stored in the database (min. quantities, tiered discounts)
- B2B account approval workflow with dedicated pricing visibility

### Promotions & Pricing
- Percentage/fixed discount coupons with usage limits and expiry
- Installment pricing display (cuotas sin interés) driven by store configuration
- Dollar-rate-aware price display for imported goods

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

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | Astro v5 (static generation + islands architecture) |
| UI interactivity | React v19 (scoped islands) |
| Styling | Tailwind CSS v3 with custom design tokens |
| Serverless APIs | Cloudflare Pages Functions (V8 isolates) |
| Database | Cloudflare D1 (SQLite at the edge) |
| CDN / Security | Cloudflare (DNS, SSL, DDoS, WAF, Turnstile) |
| Payments | Mercado Pago |
| Background jobs | Cloudflare Workers (hourly catalog sync) |
| CI/CD | GitHub → Cloudflare Pages (push-to-deploy) |
| Package management | npm |

## Project Structure

```
lanuscomputacion-repo/
├── frontend/
│   ├── migrations/          # D1 SQL migrations (001–014)
│   ├── src/
│   │   ├── components/      # React islands + Astro components
│   │   ├── layouts/         # BaseLayout, admin layouts
│   │   ├── lib/             # d1.ts (typed query layer), utils
│   │   └── pages/           # Astro routes (storefront, admin, API)
│   ├── styles.css           # Tailwind entry + design tokens
│   ├── tailwind.config.mjs  # Custom color/typography system
│   └── wrangler.jsonc       # Pages + D1 binding config
└── workers/
    └── sync-elit/           # Hourly catalog sync worker
```

## Getting Started

### Prerequisites
- Node.js 18+
- A Cloudflare account (free tier works)
- Wrangler CLI (`npm install -g wrangler`)

### Local development

```bash
git clone https://github.com/selvaggiesteban/lanuscomputacion.git
cd lanuscomputacion/frontend
npm install
npx wrangler d1 execute lanus-catalog --local --file=./migrations/001_init.sql
npm run dev
```

Open `http://localhost:4321`.

### Environment & bindings

| Binding | Type | Purpose |
|---|---|---|
| `DB` | D1 database | Product catalog, orders, users, NFC, messaging |

Secrets (payment gateways, API keys) are managed with `wrangler secret put <NAME>` — never committed to the repository.

## Database & Migrations

Migrations live in `frontend/migrations/` and are applied in order:

```bash
npx wrangler d1 execute lanus-catalog --remote --file=./migrations/<NNNN_name>.sql
```

| Migration | Purpose |
|---|---|
| 001–006 | Core schema: catalog, customers, orders, reviews, auth |
| 007 | Discount coupons |
| 008 | B2B rules moved to database |
| 009 | Store configuration |
| 010–011 | Performance indexes (15 total) |
| 012 | NFC cards + scan analytics (20 NTAG213 seeds) |
| 013 | Messaging system (channels, contacts, templates) |
| 014 | Contact import (validated against enrichment rules) |

## Deployment

Deployment is fully automated:

1. Push to `main` on GitHub
2. Cloudflare Pages builds (Astro static build, ~30 s)
3. Assets deploy to 300+ edge locations worldwide
4. Previous deploys remain available for one-click rollback

Database migrations are applied manually via Wrangler to keep schema changes deliberate and reviewable.

## Key Engineering Highlights

- **N+1 query elimination** — Replaced ~82 per-item category queries with a single recursive tree query, cutting D1 `rows_read` by ~90% and keeping the platform within free-tier limits.
- **Typed data layer** — All 80+ routes go through a single `d1.ts` module with TypeScript types for every table.
- **Parameterized SQL everywhere** — Injection-safe queries; empty-set guards on dynamic `IN` clauses.
- **Static-first rendering** — Product pages, categories, offers, and legal content are pre-generated at build time for maximum SEO and TTFB.
- **Graceful degradation** — Navigation and menus render from cached/fallback data even if the database is briefly unavailable.

## Professional Expertise

This repository demonstrates end-to-end ownership of a production web platform:

- **Frontend engineering** — Modern component architecture (Astro islands + React), mobile-first design systems, accessibility-aware markup
- **Backend & API design** — Serverless REST endpoints, session auth, payment gateway integration
- **Database engineering** — Schema design, indexing strategy, query performance forensics on serverless SQLite
- **Cloud infrastructure** — Edge computing, CDN configuration, DNS, WAF, and zero-downtime deployments
- **DevOps / CI-CD** — Git-driven trunk-based delivery with automated previews and rollbacks
- **Security** — Parameterized queries, CSP/TLS hardening, bot mitigation with Turnstile
- **Product thinking** — B2B pricing logic, promotions engine, and physical-to-digital NFC experiences

**Connect:** [linkedin.com/in/selvaggiesteban](https://www.linkedin.com/in/selvaggiesteban/) · **Email:** selvaggiesteban@gmail.com

## Author

**Esteban Selvaggi** — Full-Stack Web Developer & IT Engineering student based in Buenos Aires, Argentina.

Specializations: high-performance web architecture · AI integration · process automation (RPA) · technical SEO.

With 8+ years of experience transforming complex business requirements into scalable, secure, and efficient software solutions.

- 🌐 [selvaggiesteban.dev](https://selvaggiesteban.dev)
- 💼 [LinkedIn](https://www.linkedin.com/in/selvaggiesteban/)
- 📧 [selvaggiesteban@gmail.com](mailto:selvaggiesteban@gmail.com)

## License

This project is licensed under the MIT License.

---

*© 2026 Esteban Selvaggi · Lanús Computación*
