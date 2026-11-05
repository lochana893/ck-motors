# CK Motors — Complete Project Audit (Phase 1)

Scope: read-only audit of the current local project `C:\Users\MSI\ck-motors`. No source code, database data or migrations were changed. Only this report was added.

## How this audit was done (and its limits)

Performed:
- Inspected the local file tree, `package.json`, `next.config.ts`, `layout.tsx`, all 28 migration files, all API routes, key components and `globals.css`.
- Read-only Supabase probe using the existing `.env.local` keys (secret values were never printed or stored):
  - row counts per table via the service role;
  - one anonymous `select` per table to check what the anon key can read;
  - storage bucket list;
  - column lists for `website_settings` and `gallery`;
  - profile role counts.

Not performed in this phase (so nothing below claims they pass):
- Browser/device testing (desktop, tablet, mobile), accessibility testing, print-to-PDF testing.
- Authenticated-role RLS testing (customer A reading customer B's data, staff vs admin).
- The end-to-end customer and walk-in workflows listed in Phase 27.
- Vercel dashboard settings and domain configuration (no access).
- `npx tsc --noEmit` and `npm run build` were last run clean during the previous task. They were not re-run for this audit because no code changed. `npm run lint` fails on unrelated root scripts (see Deployment).

## 1. Environment snapshot

| Item | Finding |
|---|---|
| Local path | `C:\Users\MSI\ck-motors` (git root) |
| Branch | `main` at `a588f47` "Fix Google Maps link and update CK Motors site" |
| Working tree | Clean (`git status` empty apart from ignored files) |
| Worktrees | 3: `main`, `agents/reelforge-studio-video-generator` (`6a50181`), `agents/upgrade-gallery-media-support` (`b7a62de`). Local `main` is not guaranteed to match GitHub `main`; this was not compared against the remote |
| Stack | Next.js 16.3.4, React 19.2.8, TypeScript, Tailwind v4, `@supabase/ssr` 0.12.6, `@supabase/supabase-js` 2.115 |
| Scripts | `dev`, `build`, `start`, `lint` only (no `test`, no `typecheck`) |
| Env var names | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (`.env.local` is git-ignored and not tracked) |
| Middleware / proxy | None (no `middleware.ts` or `proxy.ts`). Route protection is client-side plus RLS and API checks |
| Live Supabase tables reachable | 38 of 40 probed (see section 4) |
| Storage buckets (live) | `message-attachments` (private), `service-media` (private), `gallery-images` (public), `gallery-media` (public) |

## 2. Project structure

Routes (App Router):
- Public: `/` (single-page site with `#services`, `#gallery`, `#contact` anchors), `/login`, `/register`, `/forgot-password`, `/reset-password`, `/complete-account`, `/privacy`, `/terms`, `not-found`.
- Authenticated: `/dashboard` (customer), `/admin` (admin and staff; single 172 KB / ~3,900-line `page.tsx`).
- API routes: `api/admin/customers`, `api/admin/customers/repair-login`, `api/admin/users`, `api/analytics`, `api/auth/phone-login`, `api/public-visit-count`, `api/security/login-activity`, `api/security/session-heartbeat`.
- Components: about 70 files across `admin/`, `dashboard/`, `reports/`, `services/`, `vehicles/`.

## 3. Features: what exists

### Working (present in code and, where probed, backed by live tables)

| Area | Evidence |
|---|---|
| Email + password login, phone + password login (`/api/auth/phone-login`, Sri Lankan normalisation in `lib/phone-number.ts`) | Code present; the phone route has a 15-minute IP rate-limit |
| Role redirects | Login page sends `admin` and `staff` to `/admin`, customers to `/dashboard`; `must_change_password` goes to `/complete-account` |
| Roles | Live `profiles`: 1 admin, 2 customers, 0 staff (staff path exists in code and RLS but has no live user to confirm) |
| Public site | Services, gallery (images and videos with lightbox), promotions, approved reviews, contact, footer, hours, social links, Google Maps link (`google_maps_url` mapped to `maps_url`), 404 page |
| Gallery media | Live `gallery` has `media_type`, `video_url`, `thumbnail_url`, `storage_path`; `gallery-media` bucket exists |
| Services and contact modal | `ServiceContactModal` (Call, WhatsApp, callback form) |
| Callback requests | Public insert RLS (status forced to `new`), staff view/update; admin list with Contacted, Completed and Cancelled |
| Customers, vehicles | Admin customer management; `vehicles` (4 rows); Vehicle Settings with brand, model and master-data browser |
| Bookings | `bookings` (4 rows); DB function `get_available_booking_slots` and trigger `validate_booking_availability` (server-side capacity check, `security definer`) |
| Job cards | `job_cards`, `job_card_status_history`, `JobCardManager`, customer `JobCardProgress` |
| Service records, parts, stock | `service_records` (4), `service_parts` (3), `stock_movements` (4), RPC `create_service_record_with_parts` |
| Invoices | `ServiceInvoices.tsx` has Authorized By / Signature / Seal; `globals.css` has `@page { size: A4 portrait; margin: 7mm 8mm }` and break-inside rules |
| Inventory, suppliers, technicians | `InventoryManager`, `SuppliersManager`, `TechniciansManager` |
| Reviews | Customer submit form (`pending`), `approved_service_reviews` view for the public |
| Notifications and audit | `admin_notifications`, `notifications`, `audit_logs` (7 rows) |
| Reports | `ReportCenter` with revenue, bookings, customers, inventory, security, etc. |
| Analytics | `site_analytics_events` (13 rows), `login_activity` (37 rows); `analytics_settings` exists live with 1 row; public counter API returns only `enabled` and `count` |
| Messages | `messages`, `message_recipients`, `message_attachments` plus a private bucket |

### Broken or not live

| # | Problem | Evidence |
|---|---|---|
| B1 | `login_sessions` table does not exist in the live DB (`PGRST205`). The Active Login Sessions feature, heartbeat and logout end-of-session cannot work until the migration is applied | Probe result; migration `20261010001500_analytics_settings_and_login_sessions.sql` not yet applied |
| B2 | `visitor_sessions` table does not exist in the live DB (`PGRST205`) even though `20260925150000_visitor_analytics.sql` defines it. Visitor metrics that depend on it (active visitor sessions, new/returning visitors) cannot be real | Probe result. This suggests that migration was applied only partially or manually |
| B3 | `login_activity.role_at_login` is absent live (reported in the previous task). Role attribution falls back to the current profile role | Same migration as B1 |
| B4 | "Customer View" is only a link opening `/` in a new tab (`admin/page.tsx` ~line 2025). There is no admin/customer toggle, no preview bar and no "Back to Admin View" | grep found no preview-mode code |

### Missing (requested in the master prompt, not found in code)

- Admin/Customer preview mode with `ADMIN PREVIEW MODE` bar (Phase 3).
- Callback request workflow beyond contacted, completed and cancelled: no Approve/Reject, no "Convert to booking" (Phase 9). Statuses are constrained to `new, contacted, completed, cancelled`. Callback form fields are limited to name, phone, service, preferred time and message; there is no vehicle or preferred-date capture.
- Review moderation "Reject": DB constraint allows only `pending, approved, hidden` (Phase 16). Reviews are not validated against ownership or completion beyond the unique constraint (23505 duplicate handling is present).
- SEO (Phase 23): no `sitemap`, no `robots`, no canonical URLs, no Open Graph or Twitter metadata, no JSON-LD LocalBusiness, no Search Console verification hook. Only one global `title` and `description` in `layout.tsx`. `/` is a client component, so per-page metadata cannot be set there.
- Separate public pages `/services`, `/gallery`, `/about`, `/contact`, `/offers`, `/reviews` do not exist; there is only the single page with anchors. There is no "About" section/page.
- Service reminders / next service recommendation (Phase 12): `next_service` / `reminder` references exist in 8 files (customer dashboard, service history, service records, invoices, job cards, reports), so this is partly implemented. Whether WhatsApp reminder links and mileage-based recommendations work was not verified.
- Test tooling: no `test` or `typecheck` scripts; no automated tests.
- Rate limiting beyond phone login: none on public inserts (callback requests, analytics POST) or on the booking route.
- Backups: no documented backup or restore procedure; no database backup files in the repo.

## 4. Database dependencies

Live probe (service-role row count / anon read result):

| Table | Rows | Anon `select` |
|---|---|---|
| profiles | 3 | 0 rows (OK, blocked) |
| bookings / vehicles / services | 4 / 4 / 6 | 0 / 0 / 1 (services is public by design) |
| job_cards / job_card_status_history | 1 / 1 | blocked |
| service_records / service_parts / stock_movements | 4 / 3 / 4 | blocked |
| inventory_parts / inventory_categories / suppliers / technicians | 1 / 14 / 1 / 2 | blocked |
| messages / message_recipients / message_attachments | 4 / 4 / 3 | blocked |
| notifications / admin_notifications / audit_logs | 11 / 1 / 7 | blocked |
| callback_requests | 1 | permission denied (OK) |
| site_analytics_events | 13 | permission denied (OK) |
| login_activity | 37 | blocked (0 rows) |
| analytics_settings | 1 | readable (intended: flag only) |
| website_settings | 1 | readable (intended; contains public business info) |
| gallery | 1 | readable (intended) |
| vehicle_brands / models / types / fuel / transmission / engine | 9 / 16 / 7 / 8 / 5 / 10 | readable by anon |
| service_reviews / approved_service_reviews / promotions / blocked_booking_dates | 0 each | n/a |
| **login_sessions** | missing | `PGRST205` |
| **visitor_sessions** | missing | `PGRST205` |

Schema findings:
- **S1 Schema drift.** Tables used by the app but not created in any migration in the repo: `profiles` (RLS is enabled in a migration, creation is not), `bookings`, `vehicles`, `services`, `notifications`, `inventory_categories`. The repo cannot rebuild the schema from scratch. These were created out of band (Supabase dashboard or removed migrations). A baseline schema export is needed.
- **S2 Conflicting vehicle master-data policies.** `20260908220000` grants `anon, authenticated` read on vehicle master tables; `20260908224500` re-creates read policies for `authenticated` only. Live anon can still read them, so an older policy survives. Behaviour is not determined by the latest migration. Decide the intended access and consolidate.
- **S3 Duplicate analytics objects.** `analytics_settings` is defined in both `20260925150000_visitor_analytics.sql` and `20261010001500_...`. The latter is `if not exists`-based and additive, so it is safe, but the older file already created the table live (1 row), so the "settings table missing" warning should now be gone for that table.
- `website_settings` uses `google_maps_url` (no `maps_url`); the app now maps both. Fixed in the previous task.
- RPCs in use: `create_service_record_with_parts`, `get_admin_workshop_summary`, `get_available_booking_slots`. All three are defined in migrations (not individually re-verified live).

## 5. Security review

| # | Severity | Finding |
|---|---|---|
| SEC1 | Info (good) | `SUPABASE_SERVICE_ROLE_KEY` is read only in `lib/supabase/admin.ts` and server route handlers; no client component references it. `.env.local` is ignored by git |
| SEC2 | Medium | `lib/supabase/admin.ts` does not import `server-only`, so an accidental client import would not fail the build. Add the guard |
| SEC3 | Medium | No middleware or proxy: `/admin` and `/dashboard` gating is client-side redirect only. Data remains protected by RLS, but the admin JS bundle is served to anyone who visits. Add server-side route protection |
| SEC4 | Medium | Public inserts (callback requests, analytics events) have no rate limiting or CAPTCHA, so spam is possible. Only `phone-login` is rate-limited |
| SEC5 | Low–Medium | RLS is enabled on all tables defined in migrations (31 of 31 defined plus `profiles`). `bookings`, `vehicles`, `services`, `notifications`, `inventory_categories` RLS state cannot be confirmed from the repo (S1). Anon reads of `bookings`, `vehicles`, `profiles` returned 0 rows, which is consistent with RLS but not proof of correct per-user policies |
| SEC6 | Medium | Authenticated cross-customer isolation (a customer reading another customer's vehicles, bookings, invoices, job cards, service media) was **not tested**. Needs a two-customer RLS test |
| SEC7 | Info | Storage: `service-media` and `message-attachments` are private; gallery buckets public. Upload limits exist on `gallery-media` and `service-media` (100 MB) in migrations. Client-side size and type validation was found; server-side enforcement beyond the bucket config was not verified |
| SEC8 | Low | No `dangerouslySetInnerHTML` found in `src` |
| SEC9 | Low | Role checks use `profiles.role`. However, `lib/protected-owner.ts` hard-codes an owner email (`PROTECTED_OWNER_EMAIL`) used by `isProtectedOwnerEmail`. The master prompt says never to hard-code an admin email. If it is only used to stop the owner account being demoted or deleted it is not an access grant, but it should move to an environment variable or a database flag. Its call sites were not reviewed |
| SEC10 | Low | `getSession()` use was not audited exhaustively; server routes should use `getUser()`. Heartbeat and analytics routes verified earlier to use the server cookie client |

## 6. Deployment and repository hygiene

- **D1** About 25 files tracked in git are one-off patch tooling and backups, not application code: `apply_*.js`, `fix_*.js`, `ck_business_hours_fix.js`, `*_STEPS.txt`, `flag_*.sql`, `ite and fix features` (stray file name), `src/app/admin/page.tsx.backup-*` (×2, 170 KB each), `src/components/admin/BusinessHoursManager.tsx.backup-*` (×2). They bloat the repo, and the `.js` scripts do blind search-and-replace on source files (the prompt warns against running them). Recommend removing them from the tree (keep in a separate archive), with approval.
- **D2** `npm run lint` fails with 18 `no-require-imports` errors, all in those root `.js` scripts (they are linted because they sit in the project root). Not caused by application code. Resolved by D1 or by an ESLint ignore.
- **D3** `next.config.ts` contains `allowedDevOrigins: ["192.168.1.10"]`, a LAN dev origin. It is harmless in production but is environment-specific.
- **D4** Admin page is one ~3,900-line client component; it builds, but it is hard to maintain and ships to every `/admin` visitor.
- **D5** `tsconfig.tsbuildinfo` is ignored; good. Environment variable names for Vercel must match section 1; actual Vercel configuration was not inspected.
- **D6** Live DB is behind the repo: migration `20261010001500_analytics_settings_and_login_sessions.sql` (and the `visitor_sessions` part of `20260925150000_...`) are not applied. Code for these features is deployed-ready but the features will report setup warnings until SQL is run.

## 7. Phase-by-phase status summary

| Phase | Status |
|---|---|
| 2 Public website | Largely present as a single page. Missing: dedicated pages, About, SEO. Mobile/overflow not tested in this audit |
| 3 Admin/Customer preview | **Missing** (only a new-tab link) |
| 4 Authentication | Present (email, phone, roles, must_change_password, forgot/reset). No live staff user to confirm staff flow |
| 5 Customer management | Present; search, profile and history completeness not verified |
| 6 Vehicle management | Present, including brand/model browser. Live data readable |
| 7 Workload / confirmation-required | Present in code (`workload`, `requires_...` hits in admin page and DB); not tested end to end |
| 8 Booking | Present with DB-side capacity trigger. Rescheduling and cancellation handling not verified |
| 9 Callback requests | **Partial** (no vehicle/date capture, no approve/reject, no convert-to-booking) |
| 10 Job cards | Present (status history table, manager). Walk-in workload classification not verified |
| 11 Invoice | Present with signature/seal text and A4 print CSS. One-page fit **not tested** |
| 12 Service history/reminders | History present; next-service/reminder code present in 8 files, not verified |
| 13 Inventory | Present with `stock_movements`; double-deduction protection not verified |
| 14 Technicians | Present; inactive-technician assignment block not verified |
| 15 Media | Present; upload progress component with cancel support appears present, not tested |
| 16 Reviews | Partial (no Reject; no moderation notes) |
| 17 Footer/contact | Present; Maps mapped to `google_maps_url`; live `website_settings` has hours, phones, social columns |
| 18–20 Analytics | Code complete; **live DB missing `visitor_sessions`, `login_sessions`, `role_at_login`** |
| 21 Notifications/audit | Present (tables with data); duplicate-prevention not verified |
| 22 Price on request | Present (`ServiceContactModal`, uses site settings) |
| 23 SEO | **Missing** |
| 24 Security/backup | See section 5; no backup procedure |
| 25 Mobile/UI/a11y | Not tested |
| 26 Migrations | Additive migrations exist; schema drift (S1) and policy conflict (S2) |
| 27 QA | tsc and build clean (previous run); lint blocked by D1/D2; no automated tests; workflows not run |
| 28 Deployment | Not inspected beyond env names; nothing pushed or deployed |

## 8. Recommended fixes (priority order)

1. **Apply the pending migration** `20261010001500_analytics_settings_and_login_sessions.sql` in the Supabase SQL editor, and confirm `visitor_sessions` exists (re-run the `visitor_sessions` section of `20260925150000_visitor_analytics.sql` if it does not). Then re-probe.
2. **Export a baseline schema** (`supabase db dump --schema public`) so `bookings`, `vehicles`, `services`, `profiles`, `notifications`, `inventory_categories` and their RLS policies are version-controlled. Do this before any further policy edits.
3. **Run an authenticated RLS test** with two customers and one staff user to confirm isolation for vehicles, bookings, invoices, job cards, service media and messages.
4. **Add server-side route protection** (proxy/middleware or server-component guards) for `/admin` and `/dashboard`, and add `import "server-only"` to `lib/supabase/admin.ts`.
5. **Implement Admin/Customer preview mode** (state in the admin shell, role-gated bar, return to the previous section).
6. **Complete callback workflow**: add vehicle and preferred date fields, approve/reject, and convert-to-booking, with rate limiting and an admin notification (additive migration).
7. **SEO**: `app/sitemap.ts`, `app/robots.ts`, per-route metadata (split the public page into a server component and a client component), canonical URLs, Open Graph, LocalBusiness JSON-LD, Search Console verification via metadata.
8. **Reviews**: add `rejected` status (additive check-constraint change) and a moderation note.
9. **Repo hygiene** (needs approval): remove the patch scripts and `.backup-*` files from the working tree, which also fixes `npm run lint`.
10. **Consolidate vehicle master-data read policies** (S2) after deciding whether anon should read them.
11. **QA pass**: browser tests at 375, 768 and 1280 px; A4 invoice print check; the two end-to-end workflows in Phase 27.
12. **Add rate limiting** for public inserts.

## 9. What was NOT verified

- Anything requiring a logged-in browser session (admin, staff, customer UI behaviour).
- Per-user RLS behaviour for authenticated roles.
- Print layout, mobile layout and accessibility.
- Vercel production settings and `ckmotors.lk` configuration.
- Equality of local `main` and GitHub `main`.
