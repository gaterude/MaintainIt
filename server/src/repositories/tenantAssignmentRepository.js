const pool = require("../config/database");

// Errors with a status code so the controller can answer 404 / 409 correctly.
function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// Every registered tenant, with their room if they have one.
async function findAllTenants() {
  const result = await pool.query(`
    SELECT
      u.id AS user_id,
      u.name,
      u.email,
      u.phone,
      t.id AS tenant_id,
      t.room_id,
      r.room_number,
      p.id AS property_id,
      p.name AS property_name,
      p.address AS property_address
    FROM users u
    LEFT JOIN tenants t ON t.user_id = u.id
    LEFT JOIN rooms r ON r.id = t.room_id
    LEFT JOIN properties p ON p.id = r.property_id
    WHERE u.role = 'tenant'
    ORDER BY u.name ASC
  `);

  return result.rows;
}

// Every room with its capacity and who is in it. "Free spots" is derived
// (capacity minus occupants) rather than stored, so it can never go out of date.
async function findAllRooms() {
  const result = await pool.query(`
    SELECT
      r.id AS room_id,
      r.room_number,
      r.capacity,
      r.property_id,
      p.name AS property_name,
      p.address AS property_address,
      COUNT(t.id)::INTEGER AS tenant_count,
      COALESCE(
        json_agg(u.name ORDER BY u.name) FILTER (WHERE t.id IS NOT NULL),
        '[]'
      ) AS occupants
    FROM rooms r
    JOIN properties p ON p.id = r.property_id
    LEFT JOIN tenants t ON t.room_id = r.id
    LEFT JOIN users u ON u.id = t.user_id
    GROUP BY r.id, r.room_number, r.capacity, r.property_id, p.name, p.address
    ORDER BY p.name ASC, r.room_number ASC
  `);

  return result.rows;
}

// Flow: lock the tenant -> lock the room -> count who is already inside
// (not counting this tenant) -> refuse if full -> save. The room lock means two
// admins clicking at the same moment cannot both take the last spot.
async function assignTenantToRoom(userId, roomId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      `SELECT id FROM users WHERE id = $1 AND role = 'tenant' FOR UPDATE`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw httpError(404, "The selected tenant does not exist.");
    }

    const roomResult = await client.query(
      `SELECT id, capacity FROM rooms WHERE id = $1 FOR UPDATE`,
      [roomId]
    );

    if (roomResult.rows.length === 0) {
      throw httpError(404, "The selected room does not exist.");
    }

    const existing = await client.query(
      `SELECT id, room_id FROM tenants WHERE user_id = $1 FOR UPDATE`,
      [userId]
    );

    if (existing.rows.length > 0 && existing.rows[0].room_id === roomId) {
      throw httpError(409, "This tenant is already assigned to that room.");
    }

    const occupied = await client.query(
      `SELECT COUNT(*)::INTEGER AS n FROM tenants WHERE room_id = $1 AND user_id <> $2`,
      [roomId, userId]
    );

    if (occupied.rows[0].n >= roomResult.rows[0].capacity) {
      throw httpError(409, "This room is full. Choose another room or vacate someone first.");
    }

    let result;

    if (existing.rows.length > 0) {
      result = await client.query(
        `UPDATE tenants SET room_id = $1, updated_at = NOW()
         WHERE user_id = $2 RETURNING *`,
        [roomId, userId]
      );
    } else {
      result = await client.query(
        `INSERT INTO tenants (id, user_id, room_id, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())
         RETURNING *`,
        [userId, roomId]
      );
    }

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// The tenant moves out: they keep their account and their old requests, but
// have no room until the admin assigns one again.
async function vacateTenant(userId) {
  const result = await pool.query(
    `UPDATE tenants SET room_id = NULL, updated_at = NOW()
     WHERE user_id = $1 AND room_id IS NOT NULL
     RETURNING id, user_id`,
    [userId]
  );

  if (result.rows.length === 0) {
    throw httpError(404, "This tenant does not have a room to vacate.");
  }

  return result.rows[0];
}

module.exports = {
  findAllTenants,
  findAllRooms,
  assignTenantToRoom,
  vacateTenant,
};