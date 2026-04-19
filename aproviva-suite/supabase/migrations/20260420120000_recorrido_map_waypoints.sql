-- recorrido_map_waypoints: puntos de recorrido en el mapa (#/mapa, mapa-pqrs.html).
-- Aplicar en Supabase SQL Editor (o supabase db push) una vez por proyecto.
-- building_id debe coincidir con js/config.js BUILDING_ID (tabla buildings si existe).

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

CREATE INDEX IF NOT EXISTS recorrido_map_waypoints_building_id_idx
  ON public.recorrido_map_waypoints (building_id);

CREATE INDEX IF NOT EXISTS recorrido_map_waypoints_sort_idx
  ON public.recorrido_map_waypoints (building_id, sort_order);

COMMENT ON TABLE public.recorrido_map_waypoints IS 'Marcadores Leaflet del recorrido; zona_label alinea con SITE_PLACES / selects Gemba.';

ALTER TABLE public.recorrido_map_waypoints ENABLE ROW LEVEL SECURITY;

-- POC: lectura/escritura con anon key (ajustar RLS antes de exposición pública amplia).
DROP POLICY IF EXISTS "recorrido_map_waypoints_select_all" ON public.recorrido_map_waypoints;
CREATE POLICY "recorrido_map_waypoints_select_all"
  ON public.recorrido_map_waypoints
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "recorrido_map_waypoints_insert_all" ON public.recorrido_map_waypoints;
CREATE POLICY "recorrido_map_waypoints_insert_all"
  ON public.recorrido_map_waypoints
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "recorrido_map_waypoints_update_all" ON public.recorrido_map_waypoints;
CREATE POLICY "recorrido_map_waypoints_update_all"
  ON public.recorrido_map_waypoints
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "recorrido_map_waypoints_delete_all" ON public.recorrido_map_waypoints;
CREATE POLICY "recorrido_map_waypoints_delete_all"
  ON public.recorrido_map_waypoints
  FOR DELETE
  TO anon, authenticated
  USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recorrido_map_waypoints TO anon, authenticated;
