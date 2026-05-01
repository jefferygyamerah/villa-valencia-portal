-- Villa Valencia/APROVIVA recorrido production backbone.
-- Safe/additive: preserves current inspection_rounds and inspection_findings writes.
-- Canonical chain:
-- inspection_plans -> inspection_plan_points -> inspection_rounds
-- -> inspection_round_results -> inspection_findings -> operational exceptions.

-- ---------------------------------------------------------------------------
-- 1) Master data: inspection plans and planned checkpoints
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inspection_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL,
  plan_code text NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'operations'
    CHECK (category IN ('operations', 'security', 'maintenance', 'cleanliness', 'inventory', 'vendor')),
  frequency text NOT NULL DEFAULT 'ad_hoc'
    CHECK (frequency IN ('daily', 'weekly', 'monthly', 'ad_hoc')),
  expected_duration_minutes integer CHECK (expected_duration_minutes IS NULL OR expected_duration_minutes > 0),
  default_start_time time,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (building_id, plan_code)
);

CREATE INDEX IF NOT EXISTS inspection_plans_building_active_idx
  ON public.inspection_plans (building_id, is_active, category);

COMMENT ON TABLE public.inspection_plans IS 'Production recorrido task lists / inspection plans for one Villa Valencia building deployment.';
COMMENT ON COLUMN public.inspection_plans.plan_code IS 'Stable local code used by seeds and later UI extraction.';

CREATE TABLE IF NOT EXISTS public.inspection_plan_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.inspection_plans(id) ON DELETE CASCADE,
  point_code text NOT NULL,
  site_place_id text,
  zona_label text,
  label text NOT NULL,
  check_type text NOT NULL DEFAULT 'boolean'
    CHECK (check_type IN ('boolean', 'qualitative', 'quantitative', 'photo_only')),
  expected_value text,
  unit text,
  sort_order integer NOT NULL DEFAULT 0,
  is_required boolean NOT NULL DEFAULT true,
  requires_photo_on_defect boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, point_code)
);

CREATE INDEX IF NOT EXISTS inspection_plan_points_plan_active_idx
  ON public.inspection_plan_points (plan_id, is_active, sort_order);

CREATE INDEX IF NOT EXISTS inspection_plan_points_site_place_idx
  ON public.inspection_plan_points (site_place_id);

COMMENT ON TABLE public.inspection_plan_points IS 'Planned checkpoints/characteristics for each recorrido plan.';

-- ---------------------------------------------------------------------------
-- 2) Result recording: one row per executed checkpoint
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inspection_round_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_round_id text NOT NULL,
  inspection_plan_point_id uuid,
  result_status text NOT NULL DEFAULT 'not_checked'
    CHECK (result_status IN ('ok', 'nok', 'not_checked', 'not_applicable')),
  result_value text,
  numeric_value numeric,
  unit text,
  is_defect boolean NOT NULL DEFAULT false,
  photo_url text,
  notes text,
  checked_at timestamptz NOT NULL DEFAULT now(),
  checked_by_label text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inspection_round_results_round_idx
  ON public.inspection_round_results (inspection_round_id, created_at);

CREATE INDEX IF NOT EXISTS inspection_round_results_point_idx
  ON public.inspection_round_results (inspection_plan_point_id);

CREATE INDEX IF NOT EXISTS inspection_round_results_defect_idx
  ON public.inspection_round_results (is_defect, result_status);

COMMENT ON TABLE public.inspection_round_results IS 'Results recording for each executed inspection point.';

DO $$
BEGIN
  IF to_regclass('public.inspection_rounds') IS NOT NULL THEN
    ALTER TABLE public.inspection_round_results
      DROP CONSTRAINT IF EXISTS inspection_round_results_round_fk;
    ALTER TABLE public.inspection_round_results
      ADD CONSTRAINT inspection_round_results_round_fk
      FOREIGN KEY (inspection_round_id) REFERENCES public.inspection_rounds(id) ON DELETE CASCADE;
  END IF;

  ALTER TABLE public.inspection_round_results
    DROP CONSTRAINT IF EXISTS inspection_round_results_point_fk;
  ALTER TABLE public.inspection_round_results
    ADD CONSTRAINT inspection_round_results_point_fk
    FOREIGN KEY (inspection_plan_point_id) REFERENCES public.inspection_plan_points(id) ON DELETE SET NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 3) Backwards-compatible bridges on current production tables
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.inspection_rounds') IS NOT NULL THEN
    ALTER TABLE public.inspection_rounds ADD COLUMN IF NOT EXISTS building_id uuid;
    ALTER TABLE public.inspection_rounds ADD COLUMN IF NOT EXISTS inspection_plan_id uuid;
    ALTER TABLE public.inspection_rounds ADD COLUMN IF NOT EXISTS plan_code text;
    ALTER TABLE public.inspection_rounds ADD COLUMN IF NOT EXISTS assigned_to_label text;
    ALTER TABLE public.inspection_rounds ADD COLUMN IF NOT EXISTS due_at timestamptz;

    ALTER TABLE public.inspection_rounds
      DROP CONSTRAINT IF EXISTS inspection_rounds_plan_fk;
    ALTER TABLE public.inspection_rounds
      ADD CONSTRAINT inspection_rounds_plan_fk
      FOREIGN KEY (inspection_plan_id) REFERENCES public.inspection_plans(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS inspection_rounds_building_status_idx
      ON public.inspection_rounds (building_id, status, scheduled_for);
    CREATE INDEX IF NOT EXISTS inspection_rounds_plan_idx
      ON public.inspection_rounds (inspection_plan_id);

    COMMENT ON COLUMN public.inspection_rounds.inspection_plan_id IS 'Nullable bridge to canonical inspection_plans. Existing ad-hoc rounds remain valid.';
    COMMENT ON COLUMN public.inspection_rounds.plan_code IS 'Denormalized plan code for legacy UI / reporting fallback.';
    COMMENT ON COLUMN public.inspection_rounds.due_at IS 'Explicit due timestamp; if null, exception views fall back to scheduled_for + 12 hours.';
  END IF;

  IF to_regclass('public.inspection_findings') IS NOT NULL THEN
    ALTER TABLE public.inspection_findings ADD COLUMN IF NOT EXISTS inspection_round_result_id uuid;
    ALTER TABLE public.inspection_findings ADD COLUMN IF NOT EXISTS inspection_plan_point_id uuid;
    ALTER TABLE public.inspection_findings ADD COLUMN IF NOT EXISTS derivation_type text
      CHECK (derivation_type IS NULL OR derivation_type IN ('maintenance', 'inventory', 'security', 'cleanliness', 'vendor', 'none'));
    ALTER TABLE public.inspection_findings ADD COLUMN IF NOT EXISTS derived_incident_ticket_id text;
    ALTER TABLE public.inspection_findings ADD COLUMN IF NOT EXISTS derived_work_assignment_id text;

    ALTER TABLE public.inspection_findings
      DROP CONSTRAINT IF EXISTS inspection_findings_result_fk;
    ALTER TABLE public.inspection_findings
      ADD CONSTRAINT inspection_findings_result_fk
      FOREIGN KEY (inspection_round_result_id) REFERENCES public.inspection_round_results(id) ON DELETE SET NULL;

    ALTER TABLE public.inspection_findings
      DROP CONSTRAINT IF EXISTS inspection_findings_plan_point_fk;
    ALTER TABLE public.inspection_findings
      ADD CONSTRAINT inspection_findings_plan_point_fk
      FOREIGN KEY (inspection_plan_point_id) REFERENCES public.inspection_plan_points(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS inspection_findings_result_idx
      ON public.inspection_findings (inspection_round_result_id);
    CREATE INDEX IF NOT EXISTS inspection_findings_plan_point_idx
      ON public.inspection_findings (inspection_plan_point_id);
    CREATE INDEX IF NOT EXISTS inspection_findings_building_status_idx
      ON public.inspection_findings (building_id, status, severity);

    COMMENT ON COLUMN public.inspection_findings.inspection_round_result_id IS 'Preferred canonical defect link; nullable for legacy findings created against a round only.';
    COMMENT ON COLUMN public.inspection_findings.inspection_plan_point_id IS 'Checkpoint that produced the finding; nullable for legacy/ad-hoc findings.';
    COMMENT ON COLUMN public.inspection_findings.derivation_type IS 'Operational routing bucket for MD04-lite and later conversion to incident/work order/inventory/vendor follow-up.';
  END IF;

  IF to_regclass('public.work_assignments') IS NOT NULL THEN
    ALTER TABLE public.work_assignments ADD COLUMN IF NOT EXISTS building_id uuid;
    ALTER TABLE public.work_assignments ADD COLUMN IF NOT EXISTS inspection_finding_id text;
    ALTER TABLE public.work_assignments ADD COLUMN IF NOT EXISTS inspection_round_id text;
    ALTER TABLE public.work_assignments ADD COLUMN IF NOT EXISTS vendor_followup_required boolean NOT NULL DEFAULT false;

    CREATE INDEX IF NOT EXISTS work_assignments_building_status_due_idx
      ON public.work_assignments (building_id, status, due_at);
    CREATE INDEX IF NOT EXISTS work_assignments_finding_idx
      ON public.work_assignments (inspection_finding_id);
  END IF;

  IF to_regclass('public.incident_tickets') IS NOT NULL THEN
    ALTER TABLE public.incident_tickets ADD COLUMN IF NOT EXISTS inspection_finding_id text;
    ALTER TABLE public.incident_tickets ADD COLUMN IF NOT EXISTS inspection_round_id text;
    CREATE INDEX IF NOT EXISTS incident_tickets_inspection_finding_idx
      ON public.incident_tickets (inspection_finding_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4) Updated_at triggers for new canonical tables
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vv_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inspection_plans_updated_at ON public.inspection_plans;
CREATE TRIGGER trg_inspection_plans_updated_at
  BEFORE UPDATE ON public.inspection_plans
  FOR EACH ROW EXECUTE PROCEDURE public.vv_set_updated_at();

DROP TRIGGER IF EXISTS trg_inspection_plan_points_updated_at ON public.inspection_plan_points;
CREATE TRIGGER trg_inspection_plan_points_updated_at
  BEFORE UPDATE ON public.inspection_plan_points
  FOR EACH ROW EXECUTE PROCEDURE public.vv_set_updated_at();

DROP TRIGGER IF EXISTS trg_inspection_round_results_updated_at ON public.inspection_round_results;
CREATE TRIGGER trg_inspection_round_results_updated_at
  BEFORE UPDATE ON public.inspection_round_results
  FOR EACH ROW EXECUTE PROCEDURE public.vv_set_updated_at();

-- ---------------------------------------------------------------------------
-- 5) RLS: same POC posture as current suite tables; tighten with Supabase Auth later.
-- ---------------------------------------------------------------------------
ALTER TABLE public.inspection_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_plan_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_round_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inspection_plans_all" ON public.inspection_plans;
CREATE POLICY "inspection_plans_all"
  ON public.inspection_plans FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "inspection_plan_points_all" ON public.inspection_plan_points;
CREATE POLICY "inspection_plan_points_all"
  ON public.inspection_plan_points FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "inspection_round_results_all" ON public.inspection_round_results;
CREATE POLICY "inspection_round_results_all"
  ON public.inspection_round_results FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspection_plans TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspection_plan_points TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspection_round_results TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6) Villa Valencia seed plan data (idempotent, guarded by building_id)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  vv_building_id uuid := '88e6c11e-4a8c-4f39-a571-5f97e7f2b774'::uuid;
  security_plan_id uuid;
  wet_plan_id uuid;
BEGIN
  INSERT INTO public.inspection_plans (
    building_id, plan_code, name, category, frequency, expected_duration_minutes, default_start_time, metadata
  )
  VALUES
    (vv_building_id, 'VV-SEC-DAILY', 'Ronda de seguridad Villa Valencia', 'security', 'daily', 35, '20:00', '{"seed":"20260429120000","source":"vv-sap-redesign"}'::jsonb),
    (vv_building_id, 'VV-WET-WEEKLY', 'Inspeccion areas humedas Villa Valencia', 'maintenance', 'weekly', 30, '08:00', '{"seed":"20260429120000","source":"vv-sap-redesign"}'::jsonb)
  ON CONFLICT (building_id, plan_code) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    frequency = EXCLUDED.frequency,
    expected_duration_minutes = EXCLUDED.expected_duration_minutes,
    default_start_time = EXCLUDED.default_start_time,
    is_active = true,
    updated_at = now();

  SELECT id INTO security_plan_id
  FROM public.inspection_plans
  WHERE building_id = vv_building_id AND plan_code = 'VV-SEC-DAILY';

  SELECT id INTO wet_plan_id
  FROM public.inspection_plans
  WHERE building_id = vv_building_id AND plan_code = 'VV-WET-WEEKLY';

  INSERT INTO public.inspection_plan_points (
    plan_id, point_code, site_place_id, zona_label, label, check_type, expected_value, sort_order, requires_photo_on_defect
  )
  VALUES
    (security_plan_id, 'GARITA-CONTROL', 'garita', 'Garita', 'Verificar garita, acceso y control de visitantes', 'boolean', 'OK', 10, true),
    (security_plan_id, 'CCTV-ALARMA', 'garita', 'Garita', 'Confirmar CCTV / alarmas sin novedad visible', 'boolean', 'OK', 20, true),
    (security_plan_id, 'CUARTO-ELECTRICO', 'cuarto_electrico', 'Cuarto Electrico', 'Revisar acceso cerrado y sin riesgo electrico visible', 'boolean', 'OK', 30, true),
    (wet_plan_id, 'PISCINA-ORDEN', 'piscina', 'Piscina', 'Revisar orden, limpieza y seguridad del area de piscina', 'qualitative', 'OK', 10, true),
    (wet_plan_id, 'BANOS-LIMPIEZA', 'banos_area_social', 'Banos area social', 'Revisar banos de area social sin faltantes ni danos', 'qualitative', 'OK', 20, true),
    (wet_plan_id, 'SALON-HUMEDAD', 'salon_fiesta', 'Salon de Fiesta', 'Verificar salon sin humedad, filtracion o dano visible', 'boolean', 'OK', 30, true)
  ON CONFLICT (plan_id, point_code) DO UPDATE SET
    site_place_id = EXCLUDED.site_place_id,
    zona_label = EXCLUDED.zona_label,
    label = EXCLUDED.label,
    check_type = EXCLUDED.check_type,
    expected_value = EXCLUDED.expected_value,
    sort_order = EXCLUDED.sort_order,
    requires_photo_on_defect = EXCLUDED.requires_photo_on_defect,
    is_active = true,
    updated_at = now();
END $$;

-- ---------------------------------------------------------------------------
-- 7) MD04-lite operational exception board
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.v_md04_lite_exceptions;
CREATE VIEW public.v_md04_lite_exceptions AS
WITH overdue_rounds AS (
  SELECT
    'MISSED_ROUND'::text AS exception_type,
    COALESCE(r.building_id, p.building_id) AS building_id,
    r.id AS source_id,
    'inspection_rounds'::text AS source_table,
    COALESCE(r.title, p.name, 'Recorrido sin titulo') AS title,
    COALESCE(r.area, p.category, '') AS area,
    'high'::text AS severity,
    COALESCE(r.status, 'unknown') AS status,
    COALESCE(r.due_at, r.scheduled_for + interval '12 hours', r.scheduled_for) AS due_at,
    r.created_at,
    jsonb_build_object(
      'round_number', r.round_number,
      'inspection_plan_id', r.inspection_plan_id,
      'plan_code', COALESCE(r.plan_code, p.plan_code)
    ) AS metadata
  FROM public.inspection_rounds r
  LEFT JOIN public.inspection_plans p ON p.id = r.inspection_plan_id
  WHERE r.status NOT IN ('completed', 'closed')
    AND COALESCE(r.due_at, r.scheduled_for + interval '12 hours', r.scheduled_for) < now()
),
open_findings AS (
  SELECT
    CASE WHEN f.severity IN ('critical', 'high') THEN 'CRITICAL_FINDING' ELSE 'OPEN_FINDING' END::text AS exception_type,
    f.building_id,
    f.id AS source_id,
    'inspection_findings'::text AS source_table,
    COALESCE(f.description, 'Hallazgo abierto') AS title,
    COALESCE(f.zona_label, '') AS area,
    COALESCE(f.severity, 'medium') AS severity,
    COALESCE(f.status, 'open') AS status,
    f.created_at + interval '24 hours' AS due_at,
    f.created_at,
    jsonb_build_object(
      'inspection_round_id', f.inspection_round_id,
      'inspection_round_result_id', f.inspection_round_result_id,
      'inspection_plan_point_id', f.inspection_plan_point_id,
      'derivation_type', f.derivation_type
    ) AS metadata
  FROM public.inspection_findings f
  WHERE COALESCE(f.status, 'open') NOT IN ('resolved', 'closed')
),
overdue_work AS (
  SELECT
    CASE WHEN w.vendor_followup_required THEN 'VENDOR_FOLLOWUP' ELSE 'OVERDUE_WO' END::text AS exception_type,
    w.building_id,
    w.id AS source_id,
    'work_assignments'::text AS source_table,
    COALESCE(w.title, 'Orden de trabajo vencida') AS title,
    COALESCE(w.area, '') AS area,
    COALESCE(w.priority, 'normal') AS severity,
    COALESCE(w.status, 'open') AS status,
    w.due_at,
    w.created_at,
    jsonb_build_object(
      'assignment_number', w.assignment_number,
      'inspection_finding_id', w.inspection_finding_id,
      'inspection_round_id', w.inspection_round_id
    ) AS metadata
  FROM public.work_assignments w
  WHERE w.due_at IS NOT NULL
    AND w.due_at < now()
    AND COALESCE(w.status, 'open') NOT IN ('completed', 'closed', 'cancelled')
),
inventory_latest AS (
  SELECT DISTINCT ON (m.inventory_item_id)
    m.inventory_item_id,
    m.inventory_location_id,
    m.balance_after,
    m.movement_at
  FROM public.inventory_movements m
  ORDER BY m.inventory_item_id, m.movement_at DESC
),
inventory_short AS (
  SELECT
    'STOCK_OUT'::text AS exception_type,
    NULL::uuid AS building_id,
    i.id AS source_id,
    'inventory_items'::text AS source_table,
    COALESCE(i.name, 'Insumo sin nombre') AS title,
    COALESCE(l.name, '') AS area,
    CASE WHEN COALESCE(il.balance_after, 0) <= 0 THEN 'critical' ELSE 'high' END::text AS severity,
    'open'::text AS status,
    now() AS due_at,
    COALESCE(il.movement_at, i.created_at) AS created_at,
    jsonb_build_object(
      'sku', i.sku,
      'balance_after', il.balance_after,
      'default_reorder_point', i.default_reorder_point,
      'inventory_location_id', il.inventory_location_id
    ) AS metadata
  FROM public.inventory_items i
  LEFT JOIN inventory_latest il ON il.inventory_item_id = i.id
  LEFT JOIN public.inventory_locations l ON l.id = il.inventory_location_id
  WHERE COALESCE(i.is_active, true)
    AND COALESCE(il.balance_after, 0) <= COALESCE(i.default_reorder_point, 0)
)
SELECT * FROM overdue_rounds
UNION ALL
SELECT * FROM open_findings
UNION ALL
SELECT * FROM overdue_work
UNION ALL
SELECT * FROM inventory_short;

COMMENT ON VIEW public.v_md04_lite_exceptions IS 'MD04-lite: due/overdue rounds, open findings, overdue work/vendor follow-up, and inventory reorder exceptions.';
GRANT SELECT ON public.v_md04_lite_exceptions TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_md04_lite_exceptions(p_building_id uuid DEFAULT NULL)
RETURNS SETOF public.v_md04_lite_exceptions
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.v_md04_lite_exceptions
  WHERE p_building_id IS NULL OR building_id IS NULL OR building_id = p_building_id
  ORDER BY
    CASE severity
      WHEN 'critical' THEN 0
      WHEN 'high' THEN 1
      WHEN 'medium' THEN 2
      WHEN 'normal' THEN 3
      ELSE 4
    END,
    due_at NULLS LAST,
    created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_md04_lite_exceptions(uuid) TO anon, authenticated;
