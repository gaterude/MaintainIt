const path = require("path");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");

// Load the root project environment file.
dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
  quiet: true,
});

// Load the database only after environment configuration.
const pool = require("../src/config/database");

function getRequiredValue(name) {
  const value = process.env[name];

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

function validateAdminDetails() {
  const name = getRequiredValue("BOOTSTRAP_ADMIN_NAME");
  const email = getRequiredValue("BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
  const phone = getRequiredValue("BOOTSTRAP_ADMIN_PHONE");
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (name.length > 100) {
    throw new Error("Administrator name cannot exceed 100 characters.");
  }

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 255
  ) {
    throw new Error("A valid administrator email address is required.");
  }

  if (!/^(?:\+254|0)(?:7\d{8}|1\d{8})$/.test(phone)) {
    throw new Error("Enter a valid Kenyan phone number.");
  }

  if (typeof password !== "string" || password.length < 12) {
    throw new Error("Administrator password must contain at least 12 characters.");
  }

  if (Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("Administrator password cannot exceed 72 UTF-8 bytes.");
  }

  return { name, email, phone, password };
}

async function bootstrapAdmin() {
  const admin = validateAdminDetails();
  const client = await pool.connect();

  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    // Serialize simultaneous bootstrap attempts.
    await client.query(
      "SELECT pg_advisory_xact_lock($1, $2)",
      [20261104, 1]
    );

    const existingAdmin = await client.query(
      "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
    );

    if (existingAdmin.rows.length > 0) {
      throw new Error(
        "An administrator already exists. First-admin bootstrap is disabled."
      );
    }

    const passwordHash = await bcrypt.hash(admin.password, 12);

    const result = await client.query(
      `
        INSERT INTO users (
          name,
          email,
          phone,
          password_hash,
          role
        )
        VALUES ($1, $2, $3, $4, 'admin')
        RETURNING id, name, email, phone, role, created_at
      `,
      [
        admin.name,
        admin.email,
        admin.phone,
        passwordHash,
      ]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    console.log("First administrator created successfully.");
    console.log({
      id: result.rows[0].id,
      name: result.rows[0].name,
      email: result.rows[0].email,
      role: result.rows[0].role,
    });

  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }

    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

bootstrapAdmin().catch((error) => {
  console.error("Administrator bootstrap failed:", error.message);
  process.exitCode = 1;
});