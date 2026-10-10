# CK Motors Analytics, Login Tracking & Vehicle Settings Fix Report

## Root cause

The live Supabase schema is only partially upgraded:

- `site_analytics_events` contains 13 historical `page_view` rows.
- `visitor_sessions` and `analytics_settings` are not present in the live schema.
- The admin page queried `visitor_sessions` directly and showed its generic error whenever that request failed. The independent page-view count queries still succeeded, which is why the total showed 13 while the session-derived metrics showed zero.
- Those 13 events contain 4 distinct visitor IDs and 4 distinct session IDs. Their existing page-view history was not changed.
- The live event table also lacks `user_id`, `operating_system`, `ip_address`, `region`, and `city`. The tracking API attempted to insert these fields, so new event inserts could fail with a missing-column error. It now retries page-view inserts using columns supported by the existing schema and continues collecting without session aggregation.
- `login_activity` contains 34 rows (27 successful and 7 failed), but it has no `role` column. Existing history remains intact; older roles are resolved from current profiles when possible.

## Completed

- Added admin-only `GET /api/analytics` and `PATCH /api/analytics` handlers. Visitor metrics now use the existing event history, paginate all events, and distinguish page views from distinct visitor IDs.
- Added loading, empty, and retry states. Missing optional session/settings schema is reported as incomplete coverage instead of incorrectly presenting the whole analytics API as unavailable.
- Visitors Today, New Visitors Today, and Returning Visitors Today use `Asia/Colombo` day boundaries. Active Sessions means a page view in the last 30 minutes.
- Guest and logged-in counts only use explicit visitor classifications or authenticated user IDs. Legacy events without that evidence remain unclassified rather than being invented as guests.
- Public page tracking keeps using the existing visitor/session identity. Admin/staff browsing and dashboard paths are excluded from public traffic. The public footer counter setting is separate from internal collection and remains OFF.
- Added admin-only login analytics API and a dedicated Login Analytics tab within Visitor Analytics. It reports stored successful/failed history, date windows, user/role/device/browser details, filters, and a masked searchable history. Full IP addresses and session secrets are not returned.
- Successful login logging now occurs only after the user and active profile have been verified; the API also verifies the authenticated account matches the submitted email. Failed attempts are recorded only from the login-submit failure path, not from page refreshes.
- Active login sessions are explicitly labeled “Not tracked”; the existing login history has no verifiable session lifecycle.
- Restyled Vehicle Settings tabs and option cards with the requested light palette while retaining existing option loading and search behavior.

## Files changed

- `src/app/api/analytics/route.ts`
- `src/app/api/security/login-activity/route.ts`
- `src/app/login/page.tsx`
- `src/components/admin/VisitorAnalyticsSection.tsx`
- `src/components/admin/LoginActivitySection.tsx`
- `src/components/admin/VehicleSettingsSection.tsx`
- `src/lib/analytics-admin-auth.ts`
- `supabase/migrations/20261003120000_analytics_login_role_tracking.sql`
- `CK_MOTORS_ANALYTICS_FIX_REPORT.md`

## Tables, authorization, and migrations

Data sources are the existing `site_analytics_events`, `visitor_sessions`, `analytics_settings`, `login_activity`, `profiles`, and Supabase Auth user records. No duplicate tracking tables were introduced.

Run these migrations manually, in this order:

1. `supabase/migrations/20260925150000_visitor_analytics.sql` — adds the missing visitor/session fields and creates `visitor_sessions` and `analytics_settings`.
2. `supabase/migrations/20261003120000_analytics_login_role_tracking.sql` — adds nullable `site_analytics_events.visitor_type` and `login_activity.role` columns, their validation constraints, and the supported contact-event types.

The first migration already existed in the repository but is not applied to the inspected live database. The new migration was not applied to production during this task. It preserves existing rows and leaves older role/visitor classifications nullable.

RLS policies were not changed. Sensitive visitor event/session and login tables use admin-only read policies; `analytics_settings` intentionally permits reading only the public-counter flag. API handlers additionally verify a signed-in user against an active `profiles.role = 'admin'` record before using the server-side service-role client. Anonymous checks returned an authorization error for `site_analytics_events` and zero visible `login_activity` rows. No service-role key is sent to the browser.

## Verification

- Live database: 13 page views, 4 distinct visitor IDs, 4 distinct session IDs; login activity contains 27 successful and 7 failed records.
- `GET /api/analytics` without an admin session: **401**, as expected.
- `GET /api/security/login-activity` without an admin session: **401**, as expected.
- `GET /api/public-visit-count`: **200**, `{"enabled":false}`.
- `npx tsc --noEmit`: **passed**.
- `npm run lint -- src`: **passed**.
- `npm run build`: **passed**.
- Repository-wide `npm run lint`: **not clean** because pre-existing, untracked root installer scripts trigger `@typescript-eslint/no-require-imports`. The errors are in `apply_all_remaining_ck_features.js`, `apply_all_remaining_features_v1.js`, `apply_ck_final_v5.js`, `apply_ck_smart_fix_v3.js`, `ck_business_hours_fix.js`, `fix_business_hours_v2.js`, `fix_service_workload_v4.js`, `fix_service_workload_v6.js`, and `fix_service_workload_v7.js`. These unrelated user files were left unchanged.

An authenticated-admin browser session was not available for interactive sign-in or visual tab testing. The protected API paths were tested without credentials, and the live source rows/schema were inspected without inserting or modifying production analytics records. Apply the two migrations above, then verify the authenticated admin dashboard and a real successful/failed login in the browser.
