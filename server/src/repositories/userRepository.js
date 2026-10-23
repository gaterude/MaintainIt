const pool = require("../config/database");

async function createUser({
  name,
  email,
  phone,
  passwordHash,
  role,
}) {
  const query = `
    INSERT INTO users (
      name,
      email,
      phone,
      password_hash,
      role
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, name, email, phone, role, created_at, updated_at
  `;

  const values = [
    name,
    email.trim().toLowerCase(),
    phone.trim(),
    passwordHash,
    role,
  ];

  const result = await pool.query(query, values);

  return result.rows[0];
}

async function findUserByEmail(email) {
  const query = `
    SELECT
      id,
      name,
      email,
      phone,
      password_hash,
      role,
      created_at,
      updated_at
    FROM users
    WHERE email = $1
    LIMIT 1
  `;

  const result = await pool.query(query, [
    email.trim().toLowerCase(),
  ]);

  return result.rows[0] || null;
}

async function findUserByPhone(phone) {
  const query = `
    SELECT id, name, email, phone, role
    FROM users
    WHERE phone = $1
    LIMIT 1
  `;

  const result = await pool.query(query, [phone.trim()]);

  return result.rows[0] || null;
}

async function findAdminUsers() {
  const query = `
    SELECT id, name, email, phone
    FROM users
    WHERE role = 'admin'
    ORDER BY created_at ASC
  `;

  const result = await pool.query(query);

  return result.rows;
}

async function findFundis() {
  const query = `
    SELECT id, name, email, phone
    FROM users
    WHERE role = 'fundi'
    ORDER BY name ASC
  `;

  const result = await pool.query(query);

  return result.rows;
}

async function findUserById(userId) {
  const query = `
    SELECT id, name, email, phone, role
    FROM users
    WHERE id = $1
    LIMIT 1
  `;

  const result = await pool.query(query, [userId]);

  return result.rows[0] || null;
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserByPhone,
  findUserById,
  findAdminUsers,
  findFundis,
};
