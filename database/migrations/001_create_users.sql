CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(100) NOT NULL,

    email VARCHAR(255) UNIQUE NOT NULL,

    phone VARCHAR(20) UNIQUE NOT NULL,

    password_hash TEXT NOT NULL,

    role VARCHAR(20) NOT NULL
        CHECK (role IN ('tenant', 'admin', 'fundi')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);