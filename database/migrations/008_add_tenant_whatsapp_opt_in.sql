BEGIN;

ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS whatsapp_opt_in
        BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS whatsapp_opted_in_at
        TIMESTAMPTZ;

ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS whatsapp_opted_out_at
        TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'tenants_whatsapp_opt_in_consent_check'
    ) THEN
        ALTER TABLE tenants
            ADD CONSTRAINT tenants_whatsapp_opt_in_consent_check
            CHECK (
                whatsapp_opt_in = FALSE
                OR whatsapp_opted_in_at IS NOT NULL
            );
    END IF;
END
$$;

COMMIT;