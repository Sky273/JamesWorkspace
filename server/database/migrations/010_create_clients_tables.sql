-- Migration: Create clients, client_contacts, and resume_submissions tables
-- Date: 2026-02-12

-- ============================================
-- TABLE: clients (Clients / Prospects)
-- ============================================

CREATE TABLE IF NOT EXISTS public.clients (
    id UUID DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    firm_id UUID NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'prospect',
    status VARCHAR(50) DEFAULT 'active',
    address TEXT,
    website VARCHAR(255),
    industry VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    CONSTRAINT clients_type_check CHECK (type IN ('client', 'prospect')),
    CONSTRAINT clients_status_check CHECK (status IN ('active', 'inactive'))
);

-- Index for firm segregation
CREATE INDEX IF NOT EXISTS idx_clients_firm_id ON public.clients(firm_id);
CREATE INDEX IF NOT EXISTS idx_clients_type ON public.clients(type);
CREATE INDEX IF NOT EXISTS idx_clients_name ON public.clients(name);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_clients_updated_at ON public.clients;
CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON public.clients
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.clients IS 'Client and prospect organizations for CV submissions';

-- ============================================
-- TABLE: client_contacts (Interlocuteurs)
-- ============================================

CREATE TABLE IF NOT EXISTS public.client_contacts (
    id UUID DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for client lookup
CREATE INDEX IF NOT EXISTS idx_client_contacts_client_id ON public.client_contacts(client_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_client_contacts_updated_at ON public.client_contacts;
CREATE TRIGGER update_client_contacts_updated_at
    BEFORE UPDATE ON public.client_contacts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.client_contacts IS 'Contact persons for clients/prospects';

-- ============================================
-- TABLE: resume_submissions (Historique d'envois)
-- ============================================

CREATE TABLE IF NOT EXISTS public.resume_submissions (
    id UUID DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    resume_id UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES public.client_contacts(id) ON DELETE CASCADE,
    mission_id UUID REFERENCES public.missions(id) ON DELETE SET NULL,
    firm_id UUID NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sent_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'sent',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT resume_submissions_status_check CHECK (status IN ('sent', 'viewed', 'rejected', 'accepted', 'pending'))
);

-- Indexes for lookups
CREATE INDEX IF NOT EXISTS idx_resume_submissions_firm_id ON public.resume_submissions(firm_id);
CREATE INDEX IF NOT EXISTS idx_resume_submissions_client_id ON public.resume_submissions(client_id);
CREATE INDEX IF NOT EXISTS idx_resume_submissions_resume_id ON public.resume_submissions(resume_id);
CREATE INDEX IF NOT EXISTS idx_resume_submissions_mission_id ON public.resume_submissions(mission_id);
CREATE INDEX IF NOT EXISTS idx_resume_submissions_sent_at ON public.resume_submissions(sent_at DESC);

COMMENT ON TABLE public.resume_submissions IS 'History of CV submissions to clients/prospects';

-- ============================================
-- ALTER TABLE: missions (Add client_id)
-- ============================================

-- Add client_id column to missions if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'missions' 
        AND column_name = 'client_id'
    ) THEN
        ALTER TABLE public.missions ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;
        CREATE INDEX idx_missions_client_id ON public.missions(client_id);
    END IF;
END $$;

-- ============================================
-- VIEW: v_clients_with_contacts
-- ============================================

CREATE OR REPLACE VIEW public.v_clients_with_contacts AS
SELECT 
    c.id,
    c.firm_id,
    c.name,
    c.type,
    c.status,
    c.address,
    c.website,
    c.industry,
    c.notes,
    c.created_at,
    c.updated_at,
    c.created_by,
    f.name AS firm_name,
    (
        SELECT COUNT(*) 
        FROM public.client_contacts cc 
        WHERE cc.client_id = c.id
    ) AS contacts_count,
    (
        SELECT COUNT(*) 
        FROM public.resume_submissions rs 
        WHERE rs.client_id = c.id
    ) AS submissions_count
FROM public.clients c
LEFT JOIN public.firms f ON c.firm_id = f.id;

COMMENT ON VIEW public.v_clients_with_contacts IS 'Clients with contact and submission counts';

-- ============================================
-- VIEW: v_resume_submissions_full
-- ============================================

CREATE OR REPLACE VIEW public.v_resume_submissions_full AS
SELECT 
    rs.id,
    rs.resume_id,
    rs.client_id,
    rs.contact_id,
    rs.mission_id,
    rs.firm_id,
    rs.sent_at,
    rs.sent_by,
    rs.notes,
    rs.status,
    rs.created_at,
    r.name AS resume_name,
    r.title AS resume_title,
    c.name AS client_name,
    c.type AS client_type,
    cc.name AS contact_name,
    cc.email AS contact_email,
    m.title AS mission_title,
    u.name AS sent_by_name,
    f.name AS firm_name
FROM public.resume_submissions rs
LEFT JOIN public.resumes r ON rs.resume_id = r.id
LEFT JOIN public.clients c ON rs.client_id = c.id
LEFT JOIN public.client_contacts cc ON rs.contact_id = cc.id
LEFT JOIN public.missions m ON rs.mission_id = m.id
LEFT JOIN public.users u ON rs.sent_by = u.id
LEFT JOIN public.firms f ON rs.firm_id = f.id;

COMMENT ON VIEW public.v_resume_submissions_full IS 'Resume submissions with full details';
