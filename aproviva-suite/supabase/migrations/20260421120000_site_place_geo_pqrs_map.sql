-- Geometría por lugar (SITE_PLACES.place_id) + join de hallazgos Gemba al mapa.
-- PQRS (Villa Valencia): objetivo = casos y agregados en este proyecto Supabase tras migración desde ph-management (ver docs/PQRS-MIGRATION-PH-TO-VV.md).
-- inspection_findings: columnas opcionales para enlazar a site_place_geo.

-- ── site_place_geo: un punto de referencia por (building_id, place_id) para leyenda / capas ──
CREATE TABLE IF NOT EXISTS public.site_place_geo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL,
  place_id text NOT NULL,
  label text NOT NULL,
  kind text NOT NULL DEFAULT 'building'
    CHECK (kind IN ('building', 'area', 'circulation')),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (building_id, place_id)
);

CREATE INDEX IF NOT EXISTS site_place_geo_building_idx
  ON public.site_place_geo (building_id);

COMMENT ON TABLE public.site_place_geo IS 'Lat/lng por place_id (SITE_PLACES); hallazgos y capas de mapa. PQRS VV: enlazar tras migración a este Supabase.';

-- ── Hallazgos Gemba: columnas para join al mapa (solo si la tabla existe) ──
DO $$
BEGIN
  IF to_regclass('public.inspection_findings') IS NOT NULL THEN
    ALTER TABLE public.inspection_findings ADD COLUMN IF NOT EXISTS building_id uuid;
    ALTER TABLE public.inspection_findings ADD COLUMN IF NOT EXISTS site_place_id text;
    ALTER TABLE public.inspection_findings ADD COLUMN IF NOT EXISTS zona_label text;
    COMMENT ON COLUMN public.inspection_findings.building_id IS 'Requerido para join con site_place_geo en vistas de mapa.';
    COMMENT ON COLUMN public.inspection_findings.site_place_id IS 'Slug SITE_PLACES, ej. piscina, gimnasio.';
    COMMENT ON COLUMN public.inspection_findings.zona_label IS 'Etiqueta humana; alinear con selects / waypoints.';
  END IF;
END $$;

-- ── Vista: hallazgos con coordenadas (solo si inspection_findings existe) ──
DROP VIEW IF EXISTS public.v_inspection_findings_map;

DO $$
BEGIN
  IF to_regclass('public.inspection_findings') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'inspection_findings' AND column_name = 'building_id'
     )
  THEN
  EXECUTE $view$
    CREATE VIEW public.v_inspection_findings_map AS
    SELECT
      f.id AS finding_id,
      f.inspection_round_id,
      f.building_id,
      f.site_place_id,
      f.zona_label,
      f.finding_type,
      f.severity,
      f.status,
      f.description,
      f.photo_url,
      f.created_at,
      g.lat,
      g.lng
    FROM public.inspection_findings f
    LEFT JOIN public.site_place_geo g
      ON g.building_id = f.building_id
     AND (
          (f.site_place_id IS NOT NULL AND g.place_id = f.site_place_id)
          OR (f.site_place_id IS NULL AND f.zona_label IS NOT NULL AND g.label = f.zona_label)
        )
  $view$;

  EXECUTE 'COMMENT ON VIEW public.v_inspection_findings_map IS ' ||
    quote_literal('Hallazgos con lat/lng desde site_place_geo; filtrar WHERE building_id IS NOT NULL en app.');
  END IF;
END $$;

-- ── RLS (POC: ajustar antes de producción pública) ──
ALTER TABLE public.site_place_geo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_place_geo_select_all" ON public.site_place_geo;
DROP POLICY IF EXISTS "site_place_geo_write_all" ON public.site_place_geo;
DROP POLICY IF EXISTS "site_place_geo_all" ON public.site_place_geo;
CREATE POLICY "site_place_geo_all"
  ON public.site_place_geo FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_place_geo TO anon, authenticated;

DO $$
BEGIN
  IF to_regclass('public.v_inspection_findings_map') IS NOT NULL THEN
    GRANT SELECT ON public.v_inspection_findings_map TO anon, authenticated;
  END IF;
END $$;

-- Manual (después de medir en el mapa o promediar waypoints por zona), ejemplo:
-- INSERT INTO public.site_place_geo (building_id, place_id, label, kind, lat, lng, sort_order) VALUES
-- ('88e6c11e-4a8c-4f39-a571-5f97e7f2b774', 'banos_area_social', 'Baños área social', 'building', 0.0, 0.0, 1);
