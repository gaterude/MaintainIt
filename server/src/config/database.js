const { Pool } = require("pg");

// Hosting (Render + Neon): one DATABASE_URL, SSL required.
// Local development: the separate DB_* values from .env, no SSL.
const connectionString = process.env.DATABASE_URL;

const pool = new Pool(
  connectionString
    ? {
        connectionString,
        ssl: process.env.DB_SSL === "false" ? false : true,
        max: 10,
      }
    : {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      }
);

// An idle connection can be dropped by the host; log it instead of crashing.
pool.on("error", (error) => {
  console.error("Unexpected database connection error:", error.message);
});

module.exports = pool;