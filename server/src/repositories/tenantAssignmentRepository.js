const pool = require("../config/database");

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
    LEFT JOIN tenants t
      ON t.user_id = u.id
    LEFT JOIN rooms r
      ON r.id = t.room_id
    LEFT JOIN properties p
      ON p.id = r.property_id
    WHERE u.role = 'tenant'
    ORDER BY u.name ASC
  `);

  return result.rows;
}

async function findAllRooms() {
  const result = await pool.query(`
    SELECT
      r.id AS room_id,
      r.room_number,
      r.property_id,
      p.name AS property_name,
      p.address AS property_address,
      COUNT(t.id)::INTEGER AS tenant_count
    FROM rooms r
    JOIN properties p
      ON p.id = r.property_id
    LEFT JOIN tenants t
      ON t.room_id = r.id
    GROUP BY
      r.id,
      r.room_number,
      r.property_id,
      p.name,
      p.address
    ORDER BY
      p.name ASC,
      r.room_number ASC
  `);

  return result.rows;
}

async function assignTenantToRoom(userId, roomId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Confirm that the selected user is a registered tenant.
    const userResult = await client.query(
      `
      SELECT id
      FROM users
      WHERE id = $1
        AND role = 'tenant'
      FOR UPDATE
      `,
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error("The selected tenant does not exist.");
    }

    // Confirm that the selected room exists.
    const roomResult = await client.query(
      `
      SELECT id
      FROM rooms
      WHERE id = $1
      `,
      [roomId]
    );

    if (roomResult.rows.length === 0) {
      throw new Error("The selected room does not exist.");
    }

    // Update the existing tenant profile when one exists.
   const existingTenant = await client.query(
  `
  SELECT id, room_id
  FROM tenants
  WHERE user_id = $1
  FOR UPDATE
  `,
  [userId]
);

if (
  existingTenant.rows.length > 0 &&
  existingTenant.rows[0].room_id === roomId
) {
  throw new Error(
    "This tenant is already assigned to that room."
  );
}

    let result;

    if (existingTenant.rows.length > 0) {
      result = await client.query(
        `
        UPDATE tenants
        SET
          room_id = $1,
          updated_at = NOW()
        WHERE user_id = $2
        RETURNING *
        `,
        [roomId, userId]
      );
    } else {
      // Create the tenant profile when assigning a room
      // to a newly registered tenant.
      result = await client.query(
        `
        INSERT INTO tenants (
          id,
          user_id,
          room_id,
          created_at,
          updated_at
        )
        VALUES (
          gen_random_uuid(),
          $1,
          $2,
          NOW(),
          NOW()
        )
        RETURNING *
        `,
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

module.exports = {
  findAllTenants,
  findAllRooms,
  assignTenantToRoom,
};