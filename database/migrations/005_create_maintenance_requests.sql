CREATE TABLE maintenance_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id UUID NOT NULL
        REFERENCES tenants(id)
        ON DELETE RESTRICT,

    room_id UUID NOT NULL
        REFERENCES rooms(id)
        ON DELETE RESTRICT,

    title VARCHAR(150) NOT NULL,

    description TEXT NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'approved',
                'assigned',
                'in_progress',
                'completed',
                'cancelled'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);