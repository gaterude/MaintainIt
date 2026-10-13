CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL UNIQUE
        REFERENCES users(id)
        ON DELETE CASCADE,

    room_id UUID NOT NULL
        REFERENCES rooms(id)
        ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);