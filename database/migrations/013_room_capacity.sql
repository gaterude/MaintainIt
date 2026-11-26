-- Room capacity and vacating.
-- capacity: how many tenants a room can hold (1 = a normal single-tenant unit).
-- tenants.room_id becomes optional so a tenant who moves out can be vacated
-- (they go back to "waiting for a room"); their old requests keep their room.

ALTER TABLE rooms
  ADD COLUMN capacity INTEGER NOT NULL DEFAULT 1
  CHECK (capacity BETWEEN 1 AND 20);

-- Rooms that already hold more tenants than 1 keep working: raise their capacity
-- to match what is there today.
UPDATE rooms r
SET capacity = GREATEST(1, c.n)
FROM (
  SELECT room_id, COUNT(*)::INTEGER AS n
  FROM tenants
  WHERE room_id IS NOT NULL
  GROUP BY room_id
) c
WHERE c.room_id = r.id;

ALTER TABLE tenants
  ALTER COLUMN room_id DROP NOT NULL;