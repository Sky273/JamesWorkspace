-- Migration: Add email_templates table and system default template
-- Date: 2026-02-21
-- Description: Email templates system with MJML support, per-firm templates

-- ============================================
-- 1. Create email_templates table
-- ============================================
CREATE TABLE IF NOT EXISTS public.email_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    firm_id uuid,
    name character varying(255) NOT NULL,
    description text,
    subject_template character varying(500) NOT NULL,
    mjml_content text NOT NULL,
    html_content text,
    is_system boolean DEFAULT false,
    is_default boolean DEFAULT false,
    status character varying(50) DEFAULT 'active'::character varying,
    created_by uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT email_templates_pkey PRIMARY KEY (id),
    CONSTRAINT email_templates_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firms(id) ON DELETE CASCADE,
    CONSTRAINT email_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL,
    CONSTRAINT email_templates_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])))
);

COMMENT ON TABLE public.email_templates IS 'Email templates with MJML content for CV submissions';

-- ============================================
-- 2. Add email_html_sent column to resume_submissions
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'resume_submissions' 
        AND column_name = 'email_html_sent'
    ) THEN
        ALTER TABLE public.resume_submissions ADD COLUMN email_html_sent text;
        RAISE NOTICE 'Column email_html_sent added to resume_submissions';
    ELSE
        RAISE NOTICE 'Column email_html_sent already exists in resume_submissions';
    END IF;
END $$;

-- ============================================
-- 3. Add email_template_id column to resume_submissions
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'resume_submissions' 
        AND column_name = 'email_template_id'
    ) THEN
        ALTER TABLE public.resume_submissions ADD COLUMN email_template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL;
        RAISE NOTICE 'Column email_template_id added to resume_submissions';
    ELSE
        RAISE NOTICE 'Column email_template_id already exists in resume_submissions';
    END IF;
END $$;

-- ============================================
-- 4. Insert system default template
-- ============================================
INSERT INTO public.email_templates (
    id,
    firm_id,
    name,
    description,
    subject_template,
    mjml_content,
    is_system,
    is_default,
    status
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    NULL,
    'Template par défaut',
    'Template système professionnel avec tous les mots-clés disponibles. Utilisez ce modèle comme base pour créer vos propres templates.',
    'Candidature - {{resume.name}} - {{resume.title}}',
    '<mjml>
  <mj-head>
    <mj-title>Email Template</mj-title>
    <mj-attributes>
      <mj-all font-family="Arial, sans-serif" />
      <mj-text font-size="14px" line-height="1.6" color="#333333" />
    </mj-attributes>
    <mj-raw>
      <meta charset="UTF-8" />
    </mj-raw>
    <mj-style>
      .keyword { color: #6366f1; font-weight: bold; }
    </mj-style>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <!-- Header -->
    <mj-section background-color="#ffffff" padding="20px">
      <mj-column>
        <mj-text align="center" font-size="24px" font-weight="bold" color="#1f2937">
          {{firm.name}}
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- Main Content -->
    <mj-section background-color="#ffffff" padding="30px 20px">
      <mj-column>
        <mj-text>
          Bonjour {{contact.firstName}},
        </mj-text>
        
        <mj-text padding-top="20px">
          Je me permets de vous adresser le profil de <strong>{{resume.name}}</strong>, <strong>{{resume.title}}</strong>, qui pourrait correspondre aux besoins de <strong>{{client.name}}</strong>.
        </mj-text>
        
        <mj-text padding-top="20px">
          Vous trouverez son CV en pièce jointe (version {{resume.version}}).
        </mj-text>
        
        <mj-text padding-top="20px">
          Je reste à votre entière disposition pour organiser un échange ou vous fournir des informations complémentaires.
        </mj-text>
        
        <mj-text padding-top="30px">
          Cordialement,
        </mj-text>
        
        <mj-text padding-top="10px" font-weight="bold">
          {{user.name}}
        </mj-text>
        
        <mj-text color="#6b7280">
          {{firm.name}}
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- Footer -->
    <mj-section background-color="#f9fafb" padding="20px">
      <mj-column>
        <mj-text align="center" font-size="12px" color="#9ca3af">
          {{date.todayLong}}
        </mj-text>
        <mj-text align="center" font-size="11px" color="#9ca3af" padding-top="10px">
          Ce message et ses pièces jointes sont confidentiels et destinés exclusivement à leur destinataire.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>',
    true,
    true,
    'active'
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    subject_template = EXCLUDED.subject_template,
    mjml_content = EXCLUDED.mjml_content,
    updated_at = CURRENT_TIMESTAMP;

-- ============================================
-- 5. Create indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_email_templates_firm_id ON public.email_templates(firm_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_is_system ON public.email_templates(is_system);
CREATE INDEX IF NOT EXISTS idx_email_templates_status ON public.email_templates(status);

-- ============================================
-- 6. Add trigger for updated_at
-- ============================================
DROP TRIGGER IF EXISTS update_email_templates_updated_at ON public.email_templates;
CREATE TRIGGER update_email_templates_updated_at
    BEFORE UPDATE ON public.email_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

RAISE NOTICE 'Email templates migration completed successfully';
