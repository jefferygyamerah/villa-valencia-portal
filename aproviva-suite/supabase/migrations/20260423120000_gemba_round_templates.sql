-- gemba_round_templates: plantillas de recorrido compartidas por edificio (suite Gemba).
-- Aplicar en Supabase SQL Editor (o supabase db push) una vez por proyecto.
-- building_id debe coincidir con js/config.js BUILDING_ID.

CREATE TABLE IF NOT EXISTS public.gemba_round_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL,
  name text NOT NULL,
  title text NOT NULL,
  area text NOT NULL,
  round_type text NOT NULL DEFAULT 'ad_hoc'
    CHECK (round_type IN ('daily', 'weekly', 'monthly', 'ad_hoc')),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gemba_round_templates_building_id_idx
  ON public.gemba_round_templates (building_id);

CREATE INDEX IF NOT EXISTS gemba_round_templates_active_idx
  ON public.gemba_round_templates (building_id, is_active);

COMMENT ON TABLE public.gemba_round_templates IS 'Plantillas compartidas para Iniciar recorrido (título/zona alineados a catálogo STAFF_QUICK_PICKS).';

ALTER TABLE public.gemba_round_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gemba_round_templates_select_all" ON public.gemba_round_templates;
CREATE POLICY "gemba_round_templates_select_all"
  ON public.gemba_round_templates
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "gemba_round_templates_insert_all" ON public.gemba_round_templates;
CREATE POLICY "gemba_round_templates_insert_all"
  ON public.gemba_round_templates
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "gemba_round_templates_update_all" ON public.gemba_round_templates;
CREATE POLICY "gemba_round_templates_update_all"
  ON public.gemba_round_templates
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "gemba_round_templates_delete_all" ON public.gemba_round_templates;
CREATE POLICY "gemba_round_templates_delete_all"
  ON public.gemba_round_templates
  FOR DELETE
  TO anon, authenticated
  USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gemba_round_templates TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.gemba_round_templates_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gemba_round_templates_updated_at ON public.gemba_round_templates;
CREATE TRIGGER trg_gemba_round_templates_updated_at
  BEFORE UPDATE ON public.gemba_round_templates
  FOR EACH ROW EXECUTE PROCEDURE public.gemba_round_templates_set_updated_at();
