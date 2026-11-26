const pool = require("../config/database");

// All properties with their rooms in one query (rooms come back as a JSON list).
async function listPropertiesWithRooms() {
  const result = await pool.query(
    `SELECT
       p.id,
       p.name,
       p.address,
       p.created_at,
       COALESCE(
         json_agg(
           json_build_object('id', r.id, 'room_number', r.room_number, 'capacity', r.capacity)
           ORDER BY r.room_number
         ) FILTER (WHERE r.id IS NOT NULL),
         '[]'
       ) AS rooms
     FROM properties p
     LEFT JOIN rooms r ON r.property_id = p.id
     GROUP BY p.id
     ORDER BY p.name`
  );

  return result.rows;
}

async function createProperty({ name, address }) {
  const result = await pool.query(
    `INSERT INTO properties (name, address)
     VALUES ($1, $2)
     RETURNING id, name, address, created_at`,
    [name, address]
  );

  return result.rows[0];
}

// Adds several rooms in one transaction. Rooms that already exist for this
// property are skipped (the table has UNIQUE (property_id, room_number)).
async function createRooms(propertyId, roomNumbers, capacity = 1) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const property = await client.query(
      "SELECT id FROM properties WHERE id = $1",
      [propertyId]
    );

    if (property.rows.length === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const created = [];
    const skipped = [];

    for (const roomNumber of roomNumbers) {
      const result = await client.query(
        `INSERT INTO rooms (property_id, room_number, capacity)
         VALUES ($1, $2, $3)
         ON CONFLICT (property_id, room_number) DO NOTHING
         RETURNING id, room_number`,
        [propertyId, roomNumber, capacity]
      );

      if (result.rows.length > 0) created.push(result.rows[0]);
      else skipped.push(roomNumber);
    }

    await client.query("COMMIT");
    return { created, skipped };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// Changes how many tenants a room can hold. The room is locked while we count,
// and we refuse to go below the number of people already living in it.
async function updateRoomCapacity(roomId, capacity) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const room = await client.query(
      "SELECT id FROM rooms WHERE id = $1 FOR UPDATE",
      [roomId]
    );

    if (room.rows.length === 0) {
      await client.query("ROLLBACK");
      return { status: "not_found" };
    }

    const occupied = await client.query(
      "SELECT COUNT(*)::INTEGER AS n FROM tenants WHERE room_id = $1",
      [roomId]
    );

    if (capacity < occupied.rows[0].n) {
      await client.query("ROLLBACK");
      return { status: "too_small", occupied: occupied.rows[0].n };
    }

    const result = await client.query(
      `UPDATE rooms SET capacity = $1, updated_at = NOW()
       WHERE id = $2 RETURNING id, room_number, capacity`,
      [capacity, roomId]
    );

    await client.query("COMMIT");
    return { status: "ok", room: result.rows[0] };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  listPropertiesWithRooms,
  createProperty,
  createRooms,
  updateRoomCapacity,
};