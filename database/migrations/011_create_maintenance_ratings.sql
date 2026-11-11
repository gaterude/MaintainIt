-- Tenant ratings for completed maintenance jobs.
-- One immutable rating per maintenance request.
-- Tenant and fundi identities are derived from existing records.

CREATE TABLE IF NOT EXISTS public.maintenance_ratings (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    maintenance_request_id UUID NOT NULL,
    score SMALLINT NOT NULL,
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT maintenance_ratings_pkey
        PRIMARY KEY (id),

    CONSTRAINT maintenance_ratings_maintenance_request_id_key
        UNIQUE (maintenance_request_id),

    CONSTRAINT maintenance_ratings_maintenance_request_id_fkey
        FOREIGN KEY (maintenance_request_id)
        REFERENCES public.maintenance_requests(id)
        ON DELETE CASCADE,

    CONSTRAINT maintenance_ratings_score_check
        CHECK (score BETWEEN 1 AND 5),

    CONSTRAINT maintenance_ratings_comment_check
        CHECK (comment IS NULL OR char_length(comment) <= 500)
);
