const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
  quiet: true,
});

const pool = require("../src/config/database");

const MIGRATION_DIRECTORY = path.resolve(
  __dirname,
  "../../database/migrations"
);

const EXPECTED_DATABASE = "maintainit";

const MIGRATION_FILES = [
  "001_create_users.sql",
  "002_create_properties.sql",
  "003_create_rooms.sql",
  "004_create_tenants.sql",
  "005_create_maintenance_requests.sql",
  "006_create_maintenance_responsibilities.sql",
  "007_create_maintenance_appointments.sql",
  "008_add_tenant_whatsapp_opt_in.sql",
  "009_complete_schema.sql",
  "010_prevent_duplicate_payments.sql",
];

const REQUIRED_TABLES = [
  "users",
  "properties",
  "rooms",
  "tenants",
  "maintenance_requests",
  "maintenance_responsibilities",
  "maintenance_appointments",
  "maintenance_assignments",
  "payments",
  "maintenance_request_history",
  "maintenance_overdue_alerts",
];

const PAYMENT_INDEX =
  "uq_payments_one_active_or_paid_per_request";

async function runBaseline() {
  if (process.env.DB_NAME !== EXPECTED_DATABASE) {
    throw new Error(
      `Safety check failed. Expected database "${EXPECTED_DATABASE}", ` +
      `but DB_NAME is "${process.env.DB_NAME || "not configured"}".`
    );
  }

  if (!fs.existsSync(MIGRATION_DIRECTORY)) {
    throw new Error("Database migrations directory was not found.");
  }

  const actualFiles = fs
    .readdirSync(MIGRATION_DIRECTORY)
    .filter((file) => /^\d{3}_.+\.sql$/i.test(file))
    .sort();

  const expectedFiles = [...MIGRATION_FILES].sort();

  if (
    JSON.stringify(actualFiles) !==
    JSON.stringify(expectedFiles)
  ) {
    throw new Error(
      "Migration files do not match the expected baseline list. " +
      "No database changes have been made."
    );
  }

  const migrations = MIGRATION_FILES.map((filename) => {
    const filePath = path.join(MIGRATION_DIRECTORY, filename);
    const sql = fs.readFileSync(filePath, "utf8");

    if (!sql.trim()) {
      throw new Error(`Migration ${filename} is empty.`);
    }

    return {
      filename,
      checksum: crypto
        .createHash("sha256")
        .update(sql, "utf8")
        .digest("hex"),
    };
  });

  const client = await pool.connect();
  let lockAcquired = false;

  try {
    const databaseResult = await client.query(
      "SELECT current_database() AS database_name"
    );

    const actualDatabase =
      databaseResult.rows[0].database_name;

    if (actualDatabase !== EXPECTED_DATABASE) {
      throw new Error(
        `Connected to "${actualDatabase}" instead of ` +
        `"${EXPECTED_DATABASE}".`
      );
    }

    console.log(`Target database: ${actualDatabase}`);

    // Use the same advisory lock as the migration runner.
    await client.query(
      "SELECT pg_advisory_lock($1, $2)",
      [20261104, 2]
    );

    lockAcquired = true;

    const ledgerResult = await client.query(`
      SELECT to_regclass('public.schema_migrations')
        IS NOT NULL AS ledger_exists
    `);

    if (ledgerResult.rows[0].ledger_exists) {
      throw new Error(
        "Migration history already exists. " +
        "Refusing to create a baseline over existing history."
      );
    }

    const tablesResult = await client.query(
      `SELECT tablename
       FROM pg_tables
       WHERE schemaname = 'public'
         AND tablename = ANY($1::text[])`,
      [REQUIRED_TABLES]
    );

    const existingTables = new Set(
      tablesResult.rows.map((row) => row.tablename)
    );

    const missingTables = REQUIRED_TABLES.filter(
      (table) => !existingTables.has(table)
    );

    if (missingTables.length > 0) {
      throw new Error(
        "Cannot establish baseline. Missing tables: " +
        missingTables.join(", ")
      );
    }

    console.log(
      `Verified ${REQUIRED_TABLES.length} required application tables.`
    );

    const indexResult = await client.query(
      `SELECT
         i.indisunique AS is_unique,
         pg_get_indexdef(i.indexrelid) AS index_definition,
         pg_get_expr(i.indpred, i.indrelid) AS index_predicate
       FROM pg_index i
       JOIN pg_class idx
         ON idx.oid = i.indexrelid
       JOIN pg_namespace ns
         ON ns.oid = idx.relnamespace
       WHERE ns.nspname = 'public'
         AND idx.relname = $1`,
      [PAYMENT_INDEX]
    );

    if (indexResult.rows.length !== 1) {
      throw new Error(
        "The duplicate-payment protection index was not found."
      );
    }

    const paymentIndex = indexResult.rows[0];

    if (
      !paymentIndex.is_unique ||
      !paymentIndex.index_definition.includes(
        "maintenance_request_id"
      ) ||
      !paymentIndex.index_predicate ||
      !["pending", "processing", "paid"].every(
        (status) => paymentIndex.index_predicate.includes(status)
      )
    ) {
      throw new Error(
        "The payment protection index does not match expectations."
      );
    }

    console.log("Verified the unique payment protection index.");

    // Check again immediately before establishing migration history.
    const duplicatesResult = await client.query(`
      SELECT maintenance_request_id
      FROM public.payments
      WHERE status IN ('pending', 'processing', 'paid')
      GROUP BY maintenance_request_id
      HAVING COUNT(*) > 1
    `);

    if (duplicatesResult.rows.length > 0) {
      throw new Error(
        "Duplicate active or paid payment records were found. " +
        "Baseline registration cancelled."
      );
    }

    await client.query("BEGIN");

    try {
      await client.query(`
        CREATE TABLE public.schema_migrations (
          filename VARCHAR(255) PRIMARY KEY,
          checksum CHAR(64) NOT NULL,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      for (const migration of migrations) {
        await client.query(
          `INSERT INTO public.schema_migrations (
             filename,
             checksum
           )
           VALUES ($1, $2)`,
          [migration.filename, migration.checksum]
        );

        console.log(`BASELINED: ${migration.filename}`);
      }

      await client.query("COMMIT");

      console.log("\nMigration baseline established successfully.");
      console.log(
        `${migrations.length} migration records registered.`
      );
      console.log(
        "No existing migration SQL was executed by this script."
      );
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    if (lockAcquired) {
      await client.query(
        "SELECT pg_advisory_unlock($1, $2)",
        [20261104, 2]
      ).catch(() => {});
    }

    client.release();
  }
}

runBaseline()
  .catch((error) => {
    console.error("Baseline failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });