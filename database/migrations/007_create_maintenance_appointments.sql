CREATE TABLE maintenance_appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    maintenance_request_id UUID NOT NULL
        REFERENCES maintenance_requests(id)
        ON DELETE RESTRICT,

    tenant_id UUID NOT NULL
        REFERENCES tenants(id)
        ON DELETE RESTRICT,

    fundi_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    proposed_visit_at TIMESTAMPTZ NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'pending_confirmation'
        CHECK (
            status IN (
                'pending_confirmation',
                'confirmed',
                'reschedule_requested',
                'rescheduled',
                'cancelled'
            )
        ),

    tenant_response_at TIMESTAMPTZ,
    tenant_response_note TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT maintenance_appointments_future_visit
        CHECK (proposed_visit_at > created_at)
);

CREATE INDEX idx_maintenance_appointments_tenant
    ON maintenance_appointments (tenant_id, created_at DESC);

CREATE INDEX idx_maintenance_appointments_fundi
    ON maintenance_appointments (fundi_id, status, proposed_visit_at);

CREATE INDEX idx_maintenance_appointments_request
    ON maintenance_appointments (maintenance_request_id, created_at DESC);
