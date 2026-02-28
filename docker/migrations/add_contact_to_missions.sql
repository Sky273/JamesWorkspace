-- Migration: Add contact_id to missions table
-- This links a mission to a specific contact person at the client

-- Add contact_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'missions' AND column_name = 'contact_id'
    ) THEN
        ALTER TABLE public.missions ADD COLUMN contact_id uuid;
        
        -- Add foreign key constraint
        ALTER TABLE public.missions 
            ADD CONSTRAINT missions_contact_id_fkey 
            FOREIGN KEY (contact_id) 
            REFERENCES public.client_contacts(id) 
            ON DELETE SET NULL;
        
        -- Add index for performance
        CREATE INDEX IF NOT EXISTS idx_missions_contact_id ON public.missions USING btree (contact_id);
        
        RAISE NOTICE 'Added contact_id column to missions table';
    ELSE
        RAISE NOTICE 'contact_id column already exists in missions table';
    END IF;
END $$;
