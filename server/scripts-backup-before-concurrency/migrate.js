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

async function runMigrations() {
  if (!process.env.DB_NAME) {
    throw new Error("DB_NAME is not configured.");
  }

  if (!fs.existsSync(MIGRATION_DIRECTORY)) {
    throw new Error("Database migrations directory was not found.");
  }

  const files = fs
    .readdirSync(MIGRATION_DIRECTORY)
    .filter((file) => /^\d{3}_.+\.sql$/i.test(file))
    .sort();

  if (files.length === 0) {
    throw new Error("No SQL migration files were found.");
  }

  const client = await pool.connect();
  let lockAcquired = false;

  try {
    console.log(`Target database: ${process.env.DB_NAME}`);
    console.log(`Found ${files.length} migration files.`);

    // Prevent simultaneous migration runs.
    await client.query(
      "SELECT pg_advisory_lock($1, $2)",
      [20261104, 2]
    );

    lockAcquired = true;

    // Refuse to adopt an existing database without migration history.
    const ledgerCheck = await client.query(`
      SELECT to_regclass('public.schema_migrations') IS NOT NULL AS exists
    `);

    const ledgerExists = ledgerCheck.rows[0].exists;

    const existingTables = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename <> 'schema_migrations'
    `);

    if (!ledgerExists && existingTables.rows.length > 0) {
      throw new Error(
        "This database already contains tables but has no migration history. " +
        "Refusing to modify an existing database."
      );
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        checksum CHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const history = await client.query(`
      SELECT filename, checksum
      FROM public.schema_migrations
    `);

    if (
      history.rows.length === 0 &&
      existingTables.rows.length > 0
    ) {
      throw new Error(
        "The migration history is empty but application tables already exist. " +
        "Refusing to adopt this database automatically."
      );
    }

    const appliedMigrations = new Map(
      history.rows.map((row) => [
        row.filename,
        row.checksum.trim(),
      ])
    );

    let applied = 0;
    let skipped = 0;

    for (const filename of files) {
      const filePath = path.join(MIGRATION_DIRECTORY, filename);
      const originalSql = fs.readFileSync(filePath, "utf8");

      if (!originalSql.trim()) {
        throw new Error(`Migration ${filename} is empty.`);
      }

      const checksum = crypto
        .createHash("sha256")
        .update(originalSql, "utf8")
        .digest("hex");

      if (appliedMigrations.has(filename)) {
        if (appliedMigrations.get(filename) !== checksum) {
          throw new Error(
            `Migration ${filename} has changed after being applied. ` +
            "Create a new migration instead."
          );
        }

        console.log(`SKIPPED: ${filename}`);
        skipped++;
        continue;
      }

      // Remove existing file-level transaction wrappers so that
      // migration execution and its history record commit atomically.
      const migrationSql = originalSql
        .replace(/^\s*BEGIN\s*;\s*/i, "")
        .replace(/\s*COMMIT\s*;\s*$/i, "");

      console.log(`APPLYING: ${filename}`);

      await client.query("BEGIN");

      try {
        await client.query(migrationSql);

        await client.query(
          `
            INSERT INTO public.schema_migrations (
              filename,
              checksum
            )
            VALUES ($1, $2)
          `,
          [filename, checksum]
        );

        await client.query("COMMIT");

        console.log(`APPLIED: ${filename}`);
        applied++;
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(
          `Migration ${filename} failed: ${error.message}`
        );
      }
    }

    console.log("\nDatabase migrations completed.");
    console.log({
      applied,
      skipped,
      total: files.length,
    });
  } finally {
    if (lockAcquired) {
      await client.query(
        "SELECT pg_advisory_unlock($1, $2)",
        [20261104, 2]
      ).catch(() => {});
    }

    client.release();
    await pool.end();
  }
}

runMigrations().catch((error) => {
  console.error("Migration runner failed:", error.message);
  process.exitCode = 1;
});