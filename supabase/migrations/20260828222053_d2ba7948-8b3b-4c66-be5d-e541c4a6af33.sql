ALTER TABLE public.flood_reports ADD COLUMN IF NOT EXISTS cep text;
CREATE INDEX IF NOT EXISTS flood_reports_cep_idx ON public.flood_reports (cep);