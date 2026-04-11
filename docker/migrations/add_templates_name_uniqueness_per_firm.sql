ALTER TABLE public.templates
DROP CONSTRAINT IF EXISTS templates_name_key;

DROP INDEX IF EXISTS public.idx_templates_name_firm_id_unique;
DROP INDEX IF EXISTS public.idx_templates_name_global_unique;

CREATE UNIQUE INDEX idx_templates_name_firm_id_unique
ON public.templates USING btree (name, firm_id)
WHERE firm_id IS NOT NULL;

CREATE UNIQUE INDEX idx_templates_name_global_unique
ON public.templates USING btree (name)
WHERE firm_id IS NULL;
