-- Migration: Add firm_id to templates table
-- This allows templates to be firm-specific
-- Date: 2026-03-05

-- Add firm_id column to templates table
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS firm_id uuid;

-- Add foreign key constraint
ALTER TABLE public.templates 
    ADD CONSTRAINT templates_firm_id_fkey 
    FOREIGN KEY (firm_id) 
    REFERENCES public.firms(id) 
    ON DELETE SET NULL;

-- Create index for firm_id
CREATE INDEX IF NOT EXISTS idx_templates_firm_id ON public.templates USING btree (firm_id);

-- Add comment
COMMENT ON COLUMN public.templates.firm_id IS 'Optional firm association - NULL means global template visible to all';

-- Note: Existing templates will have firm_id = NULL, making them global/shared templates
-- New templates created by non-admin users will be assigned their firm_id
-- Admins can create templates for any firm or global templates (firm_id = NULL)
