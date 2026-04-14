CREATE TABLE IF NOT EXISTS public.firm_credit_purchases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    firm_id uuid NOT NULL,
    user_id uuid,
    pack_id character varying(100) NOT NULL,
    credits integer NOT NULL,
    amount_cents integer NOT NULL,
    currency character varying(10) DEFAULT 'eur'::character varying NOT NULL,
    stripe_checkout_session_id character varying(255),
    stripe_payment_intent_id character varying(255),
    stripe_customer_email character varying(255),
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    checkout_url text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT firm_credit_purchases_pkey PRIMARY KEY (id),
    CONSTRAINT firm_credit_purchases_amount_cents_check CHECK ((amount_cents > 0)),
    CONSTRAINT firm_credit_purchases_credits_check CHECK ((credits > 0)),
    CONSTRAINT firm_credit_purchases_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'completed'::character varying, 'expired'::character varying, 'failed'::character varying])::text[])))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_firm_credit_purchases_checkout_session
    ON public.firm_credit_purchases USING btree (stripe_checkout_session_id)
    WHERE (stripe_checkout_session_id IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS idx_firm_credit_purchases_payment_intent
    ON public.firm_credit_purchases USING btree (stripe_payment_intent_id)
    WHERE (stripe_payment_intent_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_firm_credit_purchases_firm_status
    ON public.firm_credit_purchases USING btree (firm_id, status, created_at DESC);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'firm_credit_purchases_firm_id_fkey'
          AND table_name = 'firm_credit_purchases'
    ) THEN
        ALTER TABLE ONLY public.firm_credit_purchases
            ADD CONSTRAINT firm_credit_purchases_firm_id_fkey
            FOREIGN KEY (firm_id) REFERENCES public.firms(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'firm_credit_purchases_user_id_fkey'
          AND table_name = 'firm_credit_purchases'
    ) THEN
        ALTER TABLE ONLY public.firm_credit_purchases
            ADD CONSTRAINT firm_credit_purchases_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;
