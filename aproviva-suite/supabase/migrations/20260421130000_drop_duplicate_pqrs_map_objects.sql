-- Limpieza si aplicaste una versión anterior que creaba pqrs_map_events en este proyecto.
-- Tras migración, PQRS Villa Valencia vive en este Supabase; no mantener duplicados legacy.

DROP VIEW IF EXISTS public.v_pqrs_counts_by_place;

DROP TABLE IF EXISTS public.pqrs_map_events CASCADE;
