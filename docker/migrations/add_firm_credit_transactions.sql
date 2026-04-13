CREATE TABLE IF NOT EXISTS public.firm_credit_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    firm_id uuid NOT NULL,
    user_id uuid,
    action_type character varying(100) NOT NULL,
    credits_delta integer NOT NULL,
    balance_after integer NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    related_transaction_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT firm_credit_transactions_pkey PRIMARY KEY (id),
    CONSTRAINT firm_credit_transactions_credits_delta_check CHECK ((credits_delta <> 0))
);

CREATE INDEX IF NOT EXISTS idx_firm_credit_transactions_action_type
    ON public.firm_credit_transactions USING btree (action_type);

CREATE INDEX IF NOT EXISTS idx_firm_credit_transactions_firm_created_at
    ON public.firm_credit_transactions USING btree (firm_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_firm_credit_transactions_user_id
    ON public.firm_credit_transactions USING btree (user_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'firm_credit_transactions_firm_id_fkey'
          AND table_name = 'firm_credit_transactions'
    ) THEN
        ALTER TABLE ONLY public.firm_credit_transactions
            ADD CONSTRAINT firm_credit_transactions_firm_id_fkey
            FOREIGN KEY (firm_id) REFERENCES public.firms(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'firm_credit_transactions_user_id_fkey'
          AND table_name = 'firm_credit_transactions'
    ) THEN
        ALTER TABLE ONLY public.firm_credit_transactions
            ADD CONSTRAINT firm_credit_transactions_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'firm_credit_transactions_related_transaction_id_fkey'
          AND table_name = 'firm_credit_transactions'
    ) THEN
        ALTER TABLE ONLY public.firm_credit_transactions
            ADD CONSTRAINT firm_credit_transactions_related_transaction_id_fkey
            FOREIGN KEY (related_transaction_id) REFERENCES public.firm_credit_transactions(id) ON DELETE SET NULL;
    END IF;
END $$;
