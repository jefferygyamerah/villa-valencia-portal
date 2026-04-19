-- =============================================================================
-- Villa Valencia — ALL migrations in one run (Supabase SQL Editor → Run once)
-- Project ref: tgoitmwdpdkhlpqpwrvs
-- Or: WSL + psql (see scripts/apply-wsl.sh)
-- =============================================================================

-- --- 20260421130000 drop duplicate pqrs_map_events (if any) ---
-- Limpieza legacy
DROP VIEW IF EXISTS public.v_pqrs_counts_by_place;
DROP TABLE IF EXISTS public.pqrs_map_events CASCADE;

-- --- 20260420120000 recorrido_map_waypoints ---
CREATE TABLE IF NOT EXISTS public.recorrido_map_waypoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL,
  zona_label text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS recorrido_map_waypoints_building_id_idx ON public.recorrido_map_waypoints (building_id);
CREATE INDEX IF NOT EXISTS recorrido_map_waypoints_sort_idx ON public.recorrido_map_waypoints (building_id, sort_order);
COMMENT ON TABLE public.recorrido_map_waypoints IS 'Marcadores Leaflet del recorrido; zona_label alinea con SITE_PLACES / selects Gemba.';
ALTER TABLE public.recorrido_map_waypoints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "recorrido_map_waypoints_select_all" ON public.recorrido_map_waypoints;
CREATE POLICY "recorrido_map_waypoints_select_all" ON public.recorrido_map_waypoints FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "recorrido_map_waypoints_insert_all" ON public.recorrido_map_waypoints;
CREATE POLICY "recorrido_map_waypoints_insert_all" ON public.recorrido_map_waypoints FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "recorrido_map_waypoints_update_all" ON public.recorrido_map_waypoints;
CREATE POLICY "recorrido_map_waypoints_update_all" ON public.recorrido_map_waypoints FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "recorrido_map_waypoints_delete_all" ON public.recorrido_map_waypoints;
CREATE POLICY "recorrido_map_waypoints_delete_all" ON public.recorrido_map_waypoints FOR DELETE TO anon, authenticated USING (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recorrido_map_waypoints TO anon, authenticated;

-- --- 20260421120000 site_place_geo + inspection_findings + view ---
CREATE TABLE IF NOT EXISTS public.site_place_geo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL,
  place_id text NOT NULL,
  label text NOT NULL,
  kind text NOT NULL DEFAULT 'building' CHECK (kind IN ('building', 'area', 'circulation')),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (building_id, place_id)
);
CREATE INDEX IF NOT EXISTS site_place_geo_building_idx ON public.site_place_geo (building_id);
COMMENT ON TABLE public.site_place_geo IS 'Lat/lng por place_id (SITE_PLACES); hallazgos y capas de mapa.';
DO $$
BEGIN
  IF to_regclass('public.inspection_findings') IS NOT NULL THEN
    ALTER TABLE public.inspection_findings ADD COLUMN IF NOT EXISTS building_id uuid;
    ALTER TABLE public.inspection_findings ADD COLUMN IF NOT EXISTS site_place_id text;
    ALTER TABLE public.inspection_findings ADD COLUMN IF NOT EXISTS zona_label text;
  END IF;
END $$;
DROP VIEW IF EXISTS public.v_inspection_findings_map;
DO $$
BEGIN
  IF to_regclass('public.inspection_findings') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inspection_findings' AND column_name = 'building_id')
  THEN
    EXECUTE $view$
      CREATE VIEW public.v_inspection_findings_map AS
      SELECT f.id AS finding_id, f.inspection_round_id, f.building_id, f.site_place_id, f.zona_label,
        f.finding_type, f.severity, f.status, f.description, f.photo_url, f.created_at, g.lat, g.lng
      FROM public.inspection_findings f
      LEFT JOIN public.site_place_geo g ON g.building_id = f.building_id
        AND ((f.site_place_id IS NOT NULL AND g.place_id = f.site_place_id)
          OR (f.site_place_id IS NULL AND f.zona_label IS NOT NULL AND g.label = f.zona_label))
    $view$;
  END IF;
END $$;
ALTER TABLE public.site_place_geo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "site_place_geo_all" ON public.site_place_geo;
CREATE POLICY "site_place_geo_all" ON public.site_place_geo FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_place_geo TO anon, authenticated;
DO $$
BEGIN
  IF to_regclass('public.v_inspection_findings_map') IS NOT NULL THEN
    GRANT SELECT ON public.v_inspection_findings_map TO anon, authenticated;
  END IF;
END $$;

-- --- 20260422120000 pqrs_cases (create if missing) ---
-- --- 20260422200000 pqrs_cases align (existing table): MUST run before indexes/policies that reference building_id ---
CREATE TABLE IF NOT EXISTS public.pqrs_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL,
  case_reference text NOT NULL,
  subject text,
  description text,
  location text,
  email text,
  site_place_id text,
  zona_label text,
  tipo text,
  urgencia text,
  casa text,
  status text NOT NULL DEFAULT 'recibido' CHECK (status IN ('recibido', 'en_progreso', 'resuelto', 'cerrado')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pqrs_cases_case_reference_key UNIQUE (case_reference)
);
ALTER TABLE public.pqrs_cases ADD COLUMN IF NOT EXISTS case_reference text;
ALTER TABLE public.pqrs_cases ADD COLUMN IF NOT EXISTS building_id uuid;
ALTER TABLE public.pqrs_cases ADD COLUMN IF NOT EXISTS site_place_id text;
ALTER TABLE public.pqrs_cases ADD COLUMN IF NOT EXISTS zona_label text;
ALTER TABLE public.pqrs_cases ADD COLUMN IF NOT EXISTS tipo text;
ALTER TABLE public.pqrs_cases ADD COLUMN IF NOT EXISTS urgencia text;
ALTER TABLE public.pqrs_cases ADD COLUMN IF NOT EXISTS casa text;
ALTER TABLE public.pqrs_cases ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pqrs_cases' AND column_name = 'status') THEN
    ALTER TABLE public.pqrs_cases ADD COLUMN status text NOT NULL DEFAULT 'recibido';
  END IF;
END $$;
-- Legacy tables may use another column for the public id; map then fill gaps so lookup/trigger work.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pqrs_cases' AND column_name = 'reference') THEN
    UPDATE public.pqrs_cases SET case_reference = trim(reference::text)
    WHERE (case_reference IS NULL OR trim(case_reference) = '') AND reference IS NOT NULL AND trim(reference::text) <> '';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pqrs_cases' AND column_name = 'case_ref') THEN
    UPDATE public.pqrs_cases SET case_reference = trim(case_ref::text)
    WHERE (case_reference IS NULL OR trim(case_reference) = '') AND case_ref IS NOT NULL AND trim(case_ref::text) <> '';
  END IF;
END $$;
UPDATE public.pqrs_cases SET case_reference = 'VV-MIG-' || replace(id::text, '-', '')
WHERE case_reference IS NULL OR trim(case_reference) = '';
ALTER TABLE public.pqrs_cases ALTER COLUMN case_reference SET NOT NULL;
DO $$
BEGIN
  ALTER TABLE public.pqrs_cases ADD CONSTRAINT pqrs_cases_case_reference_key UNIQUE (case_reference);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
UPDATE public.pqrs_cases SET building_id = '88e6c11e-4a8c-4f39-a571-5f97e7f2b774'::uuid WHERE building_id IS NULL;
CREATE INDEX IF NOT EXISTS pqrs_cases_building_id_idx ON public.pqrs_cases (building_id);
CREATE INDEX IF NOT EXISTS pqrs_cases_created_at_idx ON public.pqrs_cases (created_at DESC);
CREATE INDEX IF NOT EXISTS pqrs_cases_site_place_id_idx ON public.pqrs_cases (building_id, site_place_id);
CREATE OR REPLACE FUNCTION public.pqrs_set_case_reference() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE suffix text; candidate text; panama date;
BEGIN
  IF NEW.case_reference IS NOT NULL AND trim(NEW.case_reference) <> '' THEN RETURN NEW; END IF;
  panama := (now() AT TIME ZONE 'America/Panama')::date;
  FOR i IN 1..12 LOOP
    suffix := lpad((floor(random() * 900000 + 100000))::bigint::text, 6, '0');
    candidate := 'VV-PQRS-' || to_char(panama, 'YYYYMMDD') || '-' || suffix;
    IF NOT EXISTS (SELECT 1 FROM public.pqrs_cases c WHERE c.case_reference = candidate) THEN
      NEW.case_reference := candidate; RETURN NEW;
    END IF;
  END LOOP;
  NEW.case_reference := 'VV-PQRS-' || to_char(panama, 'YYYYMMDD') || '-' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_pqrs_set_case_reference ON public.pqrs_cases;
CREATE TRIGGER trg_pqrs_set_case_reference BEFORE INSERT ON public.pqrs_cases FOR EACH ROW EXECUTE PROCEDURE public.pqrs_set_case_reference();
CREATE OR REPLACE FUNCTION public.pqrs_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_pqrs_updated_at ON public.pqrs_cases;
CREATE TRIGGER trg_pqrs_updated_at BEFORE UPDATE ON public.pqrs_cases FOR EACH ROW EXECUTE PROCEDURE public.pqrs_set_updated_at();
CREATE OR REPLACE FUNCTION public.lookup_pqrs_case(case_ref text) RETURNS SETOF public.pqrs_cases LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT * FROM public.pqrs_cases WHERE case_reference = trim(case_ref) LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.lookup_pqrs_case(text) TO anon, authenticated;
ALTER TABLE public.pqrs_cases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pqrs_cases_insert_vv_building" ON public.pqrs_cases;
CREATE POLICY "pqrs_cases_insert_vv_building" ON public.pqrs_cases FOR INSERT TO anon, authenticated
  WITH CHECK (building_id = '88e6c11e-4a8c-4f39-a571-5f97e7f2b774'::uuid);
DROP POLICY IF EXISTS "pqrs_cases_select_none" ON public.pqrs_cases;
CREATE POLICY "pqrs_cases_select_none" ON public.pqrs_cases FOR SELECT TO anon, authenticated USING (false);
DROP POLICY IF EXISTS "pqrs_cases_update_none" ON public.pqrs_cases;
CREATE POLICY "pqrs_cases_update_none" ON public.pqrs_cases FOR UPDATE TO anon, authenticated USING (false);
GRANT SELECT, INSERT ON public.pqrs_cases TO anon, authenticated;
