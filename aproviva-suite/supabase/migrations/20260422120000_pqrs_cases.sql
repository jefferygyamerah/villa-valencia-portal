-- pqrs_cases: PQRS propiedad Villa Valencia (Supabase VV). Portal usa PostgREST + RPC lookup.
-- Aplicar en Supabase SQL Editor. building_id por defecto = Villa Valencia (js/config.js BUILDING_ID).

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
  status text NOT NULL DEFAULT 'recibido'
    CHECK (status IN ('recibido', 'en_progreso', 'resuelto', 'cerrado')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pqrs_cases_case_reference_key UNIQUE (case_reference)
);

-- If pqrs_cases already existed (e.g. ph-management) without VV columns, add them before indexes/policies reference building_id.
ALTER TABLE public.pqrs_cases ADD COLUMN IF NOT EXISTS case_reference text;
ALTER TABLE public.pqrs_cases ADD COLUMN IF NOT EXISTS building_id uuid;
ALTER TABLE public.pqrs_cases ADD COLUMN IF NOT EXISTS site_place_id text;
ALTER TABLE public.pqrs_cases ADD COLUMN IF NOT EXISTS zona_label text;
ALTER TABLE public.pqrs_cases ADD COLUMN IF NOT EXISTS tipo text;
ALTER TABLE public.pqrs_cases ADD COLUMN IF NOT EXISTS urgencia text;
ALTER TABLE public.pqrs_cases ADD COLUMN IF NOT EXISTS casa text;
ALTER TABLE public.pqrs_cases ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pqrs_cases' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.pqrs_cases ADD COLUMN status text NOT NULL DEFAULT 'recibido';
  END IF;
END $$;
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
UPDATE public.pqrs_cases SET building_id = '88e6c11e-4a8c-4f39-a571-5f97e7f2b774'::uuid
WHERE building_id IS NULL;

CREATE INDEX IF NOT EXISTS pqrs_cases_building_id_idx ON public.pqrs_cases (building_id);
CREATE INDEX IF NOT EXISTS pqrs_cases_created_at_idx ON public.pqrs_cases (created_at DESC);
CREATE INDEX IF NOT EXISTS pqrs_cases_site_place_id_idx ON public.pqrs_cases (building_id, site_place_id);

COMMENT ON TABLE public.pqrs_cases IS 'PQRS radicados en Villa Valencia (runtime here); migrados desde ph-management según docs/PQRS-MIGRATION-PH-TO-VV.md';

CREATE OR REPLACE FUNCTION public.pqrs_set_case_reference()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  suffix text;
  candidate text;
  panama date;
BEGIN
  IF NEW.case_reference IS NOT NULL AND trim(NEW.case_reference) <> '' THEN
    RETURN NEW;
  END IF;
  panama := (now() AT TIME ZONE 'America/Panama')::date;
  FOR i IN 1..12 LOOP
    suffix := lpad((floor(random() * 900000 + 100000))::bigint::text, 6, '0');
    candidate := 'VV-PQRS-' || to_char(panama, 'YYYYMMDD') || '-' || suffix;
    IF NOT EXISTS (SELECT 1 FROM public.pqrs_cases c WHERE c.case_reference = candidate) THEN
      NEW.case_reference := candidate;
      RETURN NEW;
    END IF;
  END LOOP;
  NEW.case_reference := 'VV-PQRS-' || to_char(panama, 'YYYYMMDD') || '-' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pqrs_set_case_reference ON public.pqrs_cases;
CREATE TRIGGER trg_pqrs_set_case_reference
  BEFORE INSERT ON public.pqrs_cases
  FOR EACH ROW
  EXECUTE PROCEDURE public.pqrs_set_case_reference();

CREATE OR REPLACE FUNCTION public.pqrs_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pqrs_updated_at ON public.pqrs_cases;
CREATE TRIGGER trg_pqrs_updated_at
  BEFORE UPDATE ON public.pqrs_cases
  FOR EACH ROW
  EXECUTE PROCEDURE public.pqrs_set_updated_at();

-- Lookup por referencia (sin exponer listado completo a anon).
CREATE OR REPLACE FUNCTION public.lookup_pqrs_case(case_ref text)
RETURNS SETOF public.pqrs_cases
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT *
  FROM public.pqrs_cases
  WHERE case_reference = trim(case_ref)
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.lookup_pqrs_case(text) IS 'Consulta estado PQRS por referencia; usar desde portal (anon).';

GRANT EXECUTE ON FUNCTION public.lookup_pqrs_case(text) TO anon, authenticated;

ALTER TABLE public.pqrs_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pqrs_cases_insert_vv_building" ON public.pqrs_cases;
CREATE POLICY "pqrs_cases_insert_vv_building"
  ON public.pqrs_cases
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    building_id = '88e6c11e-4a8c-4f39-a571-5f97e7f2b774'::uuid
  );

DROP POLICY IF EXISTS "pqrs_cases_select_none" ON public.pqrs_cases;
CREATE POLICY "pqrs_cases_select_none"
  ON public.pqrs_cases
  FOR SELECT
  TO anon, authenticated
  USING (false);

DROP POLICY IF EXISTS "pqrs_cases_update_none" ON public.pqrs_cases;
CREATE POLICY "pqrs_cases_update_none"
  ON public.pqrs_cases
  FOR UPDATE
  TO anon, authenticated
  USING (false);

GRANT SELECT, INSERT ON public.pqrs_cases TO anon, authenticated;
