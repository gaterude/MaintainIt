CREATE TABLE maintenance_responsibilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    maintenance_request_id UUID NOT NULL UNIQUE
        REFERENCES maintenance_requests(id)
        ON DELETE CASCADE,

    responsible_party VARCHAR(20) NOT NULL
        CHECK (responsible_party IN ('tenant', 'admin')),

    reason TEXT NOT NULL,

    decided_by UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);