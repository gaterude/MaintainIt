CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    property_id UUID NOT NULL
        REFERENCES properties(id)
        ON DELETE CASCADE,

    room_number VARCHAR(50) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (property_id, room_number)
);