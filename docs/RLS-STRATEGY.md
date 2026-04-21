# Supabase RLS strategy (F6 follow-up)

The APROVIVA suite uses the **anon publishable key** in the browser with **no Supabase Auth session**. Row Level Security that restricts writes to `authenticated` roles therefore **cannot** be enabled on operational tables without one of:

1. **Supabase Auth** (email magic link, SSO, etc.) and JWT claims mapped to `admin_users` / building scope, **or**
2. **Edge Functions** using the **service role** for mutations, with the static site calling only those endpoints, **or**
3. **Network-level restriction** (IP allowlist, VPN) plus short-lived tokens — operational but not RLS alone.

## Already constrained

- **`pqrs_cases`** — insert limited to the Villa Valencia `building_id`; select/update blocked for anon (see migrations `20260422120000_pqrs_cases.sql` and align script).
- **`recorrido_map_waypoints`**, **`site_place_geo`** — policies exist in migrations; verify in Supabase Dashboard after apply.
- **`gemba_round_templates`** — permissive anon policies (same POC model as other suite tables); UI restricts edits to roles with `maestros`.

## Recommended path for full F6

1. Introduce Supabase Auth for staff/junta users (even if PIN remains the UX gate in front, map PIN → Auth session server-side or use passwordless).
2. Add `auth.uid()`-based policies joining `admin_users` (or similar) for `INSERT`/`UPDATE`/`DELETE` on `inventory_*`, `inspection_*`, `incident_*`, etc.
3. Keep **select** policies as narrow as operational needs allow (often per `building_id`).

Until then, treat the publishable key as a **soft boundary**: PIN gates UI routes; database relies on project URL secrecy + Supabase rate limits. Do not expose the anon key in public embeds unrelated to VV operations.
