BEGIN;

-- 1. Reconcile maintenance request columns with the live schema.

ALTER TABLE public.maintenance_requests
    ALTER COLUMN title DROP NOT NULL;

ALTER TABLE public.maintenance_requests
    ADD COLUMN IF NOT EXISTS category
        VARCHAR(50) NOT NULL DEFAULT 'other';

ALTER TABLE public.maintenance_requests
    ADD COLUMN IF NOT EXISTS priority
        VARCHAR(20) NOT NULL DEFAULT 'medium';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'maintenance_requests_priority_check'
          AND conrelid = 'public.maintenance_requests'::regclass
    ) THEN
        ALTER TABLE public.maintenance_requests
            ADD CONSTRAINT maintenance_requests_priority_check
            CHECK (priority IN ('urgent', 'medium', 'low'));
    END IF;
END
$$;

-- 2. Reconcile maintenance responsibility costs.

ALTER TABLE public.maintenance_responsibilities
    ADD COLUMN IF NOT EXISTS repair_cost_cents INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'maintenance_responsibilities_repair_cost_cents_check'
          AND conrelid = 'public.maintenance_responsibilities'::regclass
    ) THEN
        ALTER TABLE public.maintenance_responsibilities
            ADD CONSTRAINT maintenance_responsibilities_repair_cost_cents_check
            CHECK (repair_cost_cents > 0);
    END IF;
END
$$;

-- 3. Maintenance assignments.

CREATE TABLE IF NOT EXISTS public.maintenance_assignments (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    maintenance_request_id UUID NOT NULL,
    fundi_id UUID NOT NULL,
    assigned_by UUID NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    CONSTRAINT maintenance_assignments_pkey
        PRIMARY KEY (id),

    CONSTRAINT maintenance_assignments_maintenance_request_id_key
        UNIQUE (maintenance_request_id),

    CONSTRAINT maintenance_assignments_maintenance_request_id_fkey
        FOREIGN KEY (maintenance_request_id)
        REFERENCES public.maintenance_requests(id)
        ON DELETE CASCADE,

    CONSTRAINT maintenance_assignments_fundi_id_fkey
        FOREIGN KEY (fundi_id)
        REFERENCES public.users(id)
        ON DELETE RESTRICT,

    CONSTRAINT maintenance_assignments_assigned_by_fkey
        FOREIGN KEY (assigned_by)
        REFERENCES public.users(id)
        ON DELETE RESTRICT
);

-- 4. Payments.

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    maintenance_request_id UUID NOT NULL,
    payer_id UUID NOT NULL,
    amount_cents INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(20) NOT NULL DEFAULT 'mpesa',
    transaction_reference VARCHAR(100),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    checkout_request_id VARCHAR(100),
    confirmed_by UUID,

    CONSTRAINT payments_pkey
        PRIMARY KEY (id),

    CONSTRAINT payments_amount_cents_check
        CHECK (amount_cents > 0),

    CONSTRAINT payments_payment_method_check
        CHECK (payment_method IN ('mpesa', 'cash')),

    CONSTRAINT payments_status_check
        CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'cancelled')),

    CONSTRAINT payments_maintenance_request_id_fkey
        FOREIGN KEY (maintenance_request_id)
        REFERENCES public.maintenance_requests(id)
        ON DELETE RESTRICT,

    CONSTRAINT payments_payer_id_fkey
        FOREIGN KEY (payer_id)
        REFERENCES public.users(id)
        ON DELETE RESTRICT,

    CONSTRAINT payments_confirmed_by_fkey
        FOREIGN KEY (confirmed_by)
        REFERENCES public.users(id),

    CONSTRAINT payments_checkout_request_id_key
        UNIQUE (checkout_request_id),

    CONSTRAINT payments_transaction_reference_key
        UNIQUE (transaction_reference)
);

-- 5. Maintenance request history.

CREATE TABLE IF NOT EXISTS public.maintenance_request_history (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    maintenance_request_id UUID NOT NULL,
    changed_by UUID NOT NULL,
    old_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT maintenance_request_history_pkey
        PRIMARY KEY (id),

    CONSTRAINT maintenance_request_history_maintenance_request_id_fkey
        FOREIGN KEY (maintenance_request_id)
        REFERENCES public.maintenance_requests(id)
        ON DELETE CASCADE,

    CONSTRAINT maintenance_request_history_changed_by_fkey
        FOREIGN KEY (changed_by)
        REFERENCES public.users(id)
        ON DELETE RESTRICT
);

-- 6. Overdue alert tracking.

CREATE TABLE IF NOT EXISTS public.maintenance_overdue_alerts (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    maintenance_request_id UUID NOT NULL,
    recipient_user_id UUID NOT NULL,
    recipient_phone VARCHAR(20) NOT NULL,
    alert_type VARCHAR(40) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    last_attempt_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT maintenance_overdue_alerts_pkey
        PRIMARY KEY (id),

    CONSTRAINT maintenance_overdue_alerts_attempts_check
        CHECK (attempts >= 0),

    CONSTRAINT maintenance_overdue_alerts_status_check
        CHECK (status IN ('pending', 'sent', 'failed')),

    CONSTRAINT maintenance_overdue_alerts_maintenance_request_id_fkey
        FOREIGN KEY (maintenance_request_id)
        REFERENCES public.maintenance_requests(id)
        ON DELETE CASCADE,

    CONSTRAINT maintenance_overdue_alerts_recipient_user_id_fkey
        FOREIGN KEY (recipient_user_id)
        REFERENCES public.users(id)
        ON DELETE RESTRICT,

    CONSTRAINT unique_overdue_alert
        UNIQUE (maintenance_request_id, recipient_user_id, alert_type)
);

-- 7. Indexes used by the existing application.

CREATE INDEX IF NOT EXISTS idx_maintenance_assignments_fundi_id
    ON public.maintenance_assignments (fundi_id);

CREATE INDEX IF NOT EXISTS idx_payments_payer_id
    ON public.payments (payer_id);

CREATE INDEX IF NOT EXISTS idx_payments_status
    ON public.payments (status);

CREATE INDEX IF NOT EXISTS idx_maintenance_request_history_request_id
    ON public.maintenance_request_history (maintenance_request_id);

CREATE INDEX IF NOT EXISTS idx_maintenance_overdue_alerts_status
    ON public.maintenance_overdue_alerts (status);

CREATE INDEX IF NOT EXISTS idx_maintenance_requests_room_id
    ON public.maintenance_requests (room_id);

CREATE INDEX IF NOT EXISTS idx_maintenance_requests_status
    ON public.maintenance_requests (status);

CREATE INDEX IF NOT EXISTS idx_maintenance_requests_tenant_id
    ON public.maintenance_requests (tenant_id);

COMMIT;
