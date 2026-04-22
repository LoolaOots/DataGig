# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Goal

DataGigs is a two-sided marketplace for sensor data collection:
- **Companies** post gigs describing physical activities they need recorded (e.g. walking, running, horse gaits). They fund a balance, publish gigs, and review applicants.
- **Users (data collectors)** browse gigs, apply with their device type, get accepted, and use the DataGigs phone app to submit sensor recordings. They earn credits redeemable as real payouts via Stripe.
- **Admins** manage the platform, review submissions, and oversee the ledger.

---

## Commands

```bash
npm run dev      # Start development server at http://localhost:3000
npm run build    # Production build
npm run lint     # Run ESLint
npx inngest-cli@latest dev   # Start Inngest local dev server (required for background jobs + emails)
```

No test runner is configured yet.

---

## Tech Stack

| Layer | Tool |
|---|---|
| Frontend + API | Next.js 16 App Router, TypeScript, Tailwind CSS v4 |
| Database | Supabase (PostgreSQL) |
| ORM | Prisma 7 with `@prisma/adapter-pg` driver adapter |
| Auth | Supabase Auth + `@supabase/ssr` |
| Payments | Stripe Connect (Checkout for deposits, Express for user payouts) |
| Email | Resend (`onboarding@resend.dev` for dev/testing) |
| Background Jobs | Inngest |
| File Storage | Supabase Storage (`sensor-data` bucket) |

---

## Architecture

- `src/app/` — App Router pages and API routes
- `src/components/` — Shared UI components (TopNav, UserMenu, NotificationBell, etc.)
- `src/lib/` — Shared utilities: `prisma.ts`, `supabase/server.ts`, `supabase/client.ts`, `inngest/client.ts`, `inngest/functions.ts`
- `prisma/schema.prisma` — Full database schema
- `src/proxy.ts` — Next.js 16 middleware (exported as `proxy`, not `middleware`)
- Path alias `@/*` maps to `src/*`
- Tailwind CSS v4 — no `tailwind.config` file, configured via `postcss.config.mjs`

---

## Service Connections

### Supabase
- Client: `createClient()` from `@/lib/supabase/server` (server components/API routes) or `@/lib/supabase/client` (client components)
- Always use `supabase.auth.getUser()` — never `getSession()` — for auth checks in API routes
- Supabase joined relations return arrays; always cast with `as unknown as Type` not just `as Type`
- Realtime enabled on `notifications` table (run `supabase/migrations/002_realtime.sql`)
- Auth trigger in `supabase/migrations/001_auth_trigger.sql` creates `users` row and profile skeleton on signup

### Prisma
- Schema: `prisma/schema.prisma` — datasource block has NO `url` field; connection is handled in `prisma.config.ts`
- All enums use `@@map("snake_case")` to match PostgreSQL enum type names
- Client instantiated in `src/lib/prisma.ts` using `pg.Pool` with `connectionString`, `ssl: { rejectUnauthorized: false }`, `max: 1`
- After any schema change: `DATABASE_URL="..." npx prisma generate`
- DATABASE_URL must use the Supabase **session mode pooler** (`aws-0-us-west-2.pooler.supabase.com:5432`, `?pgbouncer=true`)
- Special characters in the DB password must be URL-encoded

### Stripe
- Company deposits: `POST /api/stripe/checkout` → Stripe Checkout session → `checkout.session.completed` webhook → credits `company_profiles.balance_cents`
- User payouts: `POST /api/stripe/connect/onboard` → Stripe Express account link → `account.updated` webhook sets `stripe_onboarding_complete`
- Webhook handler: `POST /api/webhooks/stripe` — uses `stripe_webhook_events` table for idempotency
- Env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

### Resend
- Instantiated in `src/lib/inngest/functions.ts` as `new Resend(process.env.RESEND_API_KEY)`
- Dev/test sender: `onboarding@resend.dev` (only delivers to the Resend account owner's email)
- Emails sent from Inngest background jobs (accept, deny, payout)

### Inngest
- Client: `src/lib/inngest/client.ts`
- Functions: `src/lib/inngest/functions.ts` — registered at `POST /api/inngest`
- Must run `npx inngest-cli@latest dev` locally for functions to execute; view at `http://localhost:8288`
- Env vars: `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`

---

## Route Structure

### Pages
| Path | Role | Purpose |
|---|---|---|
| `/` | Public | Landing page |
| `/gigs` | Public | Browse marketplace |
| `/gigs/[id]` | Public | Gig detail + apply button |
| `/login`, `/signup` | Public | Auth (signup has role selection) |
| `/auth/callback` | Public | Supabase PKCE handler |
| `/dashboard` | User | Credits, recent applications |
| `/dashboard/applications` | User | All applications |
| `/dashboard/applications/[id]` | User | Application detail + assignment code |
| `/dashboard/submissions` | User | Submission history |
| `/dashboard/earnings` | User | Balance + payout history |
| `/dashboard/payouts/setup` | User | Stripe Express onboarding |
| `/company/dashboard` | Company | Balance, active gigs |
| `/company/gigs` | Company | Gig list (filter: all / active) |
| `/company/gigs/new` | Company | Multi-step gig creation |
| `/company/gigs/[id]` | Company | Gig detail + publish |
| `/company/gigs/[id]/applications` | Company | Review applicants |
| `/company/billing` | Company | Balance + deposit history |
| `/company/support` | Company | Support contact page |
| `/settings` | Both | Profile settings |
| `/help` | User | Help + contact page |
| `/admin/*` | Admin | Platform management |

### Key API Routes
| Route | Purpose |
|---|---|
| `POST /api/applications` | User applies to a gig |
| `PATCH /api/applications/[id]` | Company accepts or denies |
| `GET/POST /api/gigs` | List or create gigs |
| `GET /api/gigs/[id]` | Get gig detail (used by apply page) |
| `POST /api/gigs/[id]/publish` | Publish gig with escrow check |
| `POST /api/submissions` | Get signed upload URL |
| `POST /api/submissions/confirm` | Record submission, trigger verify job |
| `POST /api/stripe/checkout` | Create Stripe Checkout session |
| `POST /api/stripe/connect/onboard` | Create Stripe Express account link |
| `POST /api/payouts/request` | User requests payout |
| `POST /api/webhooks/stripe` | Stripe webhook handler |
| `POST /api/inngest` | Inngest function registration endpoint |

---

## Data Models (Key Tables)

### User
```
users: id (uuid), email, role (user | company | admin)
user_profiles: user_id, display_name, bio, phone, age, state_country,
               stripe_account_id, stripe_onboarding_complete,
               credits_balance_cents
company_profiles: user_id, company_name, logo_url, website_url,
                  description, stripe_customer_id, balance_cents
```

### Gig
```
gigs: id, company_id, title, description, activity_type,
      status (draft|open|paused|completed|cancelled),
      total_slots, filled_slots, application_deadline,
      data_deadline, published_at

gig_labels: id, gig_id, label_name, description, duration_seconds,
            rate_cents, quantity_needed, quantity_fulfilled
            UNIQUE(gig_id, label_name)

gig_device_requirements: id, gig_id, device_type (apple_watch|generic_android|generic_ios)
                         UNIQUE(gig_id, device_type)
```

### Application & Submission
```
applications: id, gig_id, user_id, status (pending|accepted|denied|withdrawn),
              assignment_code (unique, set on acceptance), device_type,
              note_from_user, note_from_company, applied_at, reviewed_at
              UNIQUE(gig_id, user_id)

submissions: id, application_id, gig_label_id, assignment_code,
             status (pending_review|accepted|rejected), storage_path,
             file_size_bytes, duration_seconds, device_type,
             device_metadata (jsonb), verification_result (jsonb),
             verified_at, submitted_at
```

### Finance
```
ledger_entries: id, type (deposit|escrow_hold|escrow_release|payout|refund|platform_fee),
                amount_cents, company_id?, user_id?, submission_id?,
                stripe_payment_intent_id?, stripe_transfer_id?, description
                (append-only, never updated)

gig_escrow_holds: id, gig_id (unique), company_id,
                  total_held_cents, released_cents, refunded_cents

payout_requests: id, user_id, amount_cents,
                 status (pending|in_transit|paid|failed|cancelled),
                 stripe_transfer_id, stripe_payout_id, failure_reason
```

### Other
```
notifications: id, user_id, type, title, body, is_read, metadata (jsonb)
stripe_webhook_events: stripe_event_id (unique), type, processed, raw_payload
```

---

## Important Rules & Gotchas

- **Commits**: Only the human makes git commits. Never run `git commit`.
- **Credentials alert** — if any code, config, or file you write or encounter contains credentials, passwords, API keys, or tokens, immediately alert the user and add a `// credentials` comment on the line immediately after.
- **Middleware**: File is `src/proxy.ts`, exports `proxy` (not `middleware.ts`/`middleware`)
- **Prisma enums**: All enums must have `@@map("snake_case")` to match PostgreSQL types
- **Supabase types**: Always cast joined relations with `as unknown as Type`
- **Turbopack cache**: If you see strange errors, stop the server first (`Ctrl+C`), then `rm -rf .next`, then restart. Never delete `.next` while the server is running.
- **DATABASE_URL**: Use session mode pooler, URL-encode special chars in password, append `?pgbouncer=true`
- **Input fields**: Always include `bg-white text-gray-900 placeholder:text-gray-400` to prevent white-on-white text
- **All monetary values** are stored in cents (integers), displayed as dollars with `.toFixed(2)`
- **Ledger entries** are append-only — never update them

