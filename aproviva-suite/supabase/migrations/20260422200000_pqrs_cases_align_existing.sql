-- Si pqrs_cases ya existía (p. ej. ph-management) sin columnas VV, alinear sin borrar datos.
-- Ejecutar después de 20260422120000. Idempotente.

ALTER TABLE public.pqrs_cases
  ADD COLUMN IF NOT EXISTS building_id uuid,
  ADD COLUMN IF NOT EXISTS site_place_id text,
  ADD COLUMN IF NOT EXISTS zona_label text,
  ADD COLUMN IF NOT EXISTS tipo text,
  ADD COLUMN IF NOT EXISTS urgencia text,
  ADD COLUMN IF NOT EXISTS casa text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Asegurar status con check compatible (omitir si ya existe distinto)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pqrs_cases' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.pqrs_cases ADD COLUMN status text NOT NULL DEFAULT 'recibido';
  END IF;
END $$;

UPDATE public.pqrs_cases SET building_id = '88e6c11e-4a8c-4f39-a571-5f97e7f2b774'::uuid
WHERE building_id IS NULL;

CREATE INDEX IF NOT EXISTS pqrs_cases_building_id_idx ON public.pqrs_cases (building_id);
CREATE INDEX IF NOT EXISTS pqrs_cases_site_place_id_idx ON public.pqrs_cases (building_id, site_place_id);

-- Función lookup (reemplazar si ya existía otra firma)
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

COMMENT ON FUNCTION public.lookup_pqrs_case(text) IS 'Consulta PQRS por referencia; anon usa RPC.';

GRANT EXECUTE ON FUNCTION public.lookup_pqrs_case(text) TO anon, authenticated;

ALTER TABLE public.pqrs_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pqrs_cases_insert_vv_building" ON public.pqrs_cases;
CREATE POLICY "pqrs_cases_insert_vv_building"
  ON public.pqrs_cases
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (building_id = '88e6c11e-4a8c-4f39-a571-5f97e7f2b774'::uuid);

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
