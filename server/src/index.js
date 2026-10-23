const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool = require("./config/database");

const userRoutes = require("./routes/userRoutes");
const maintenanceRequestRoutes = require("./routes/maintenanceRequestRoutes");
const maintenanceResponsibilityRoutes = require("./routes/maintenanceResponsibilityRoutes");
const maintenanceAssignmentRoutes = require("./routes/maintenanceAssignmentRoutes");
const maintenanceHistoryRoutes = require("./routes/maintenanceHistoryRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const tenantAssignmentRoutes = require("./routes/tenantAssignmentRoutes");

const {
startOverdueMaintenanceScheduler,
} = require("./jobs/overdueMaintenanceScheduler");

const app = express();
const PORT = Number(process.env.PORT) || 4000;

const allowedOrigins = (
process.env.CLIENT_URL || "http://localhost:5173"
)
.split(",")
.map((origin) => origin.trim())
.filter(Boolean);

app.disable("x-powered-by");

app.use(
cors({
origin(origin, callback) {
if (!origin || allowedOrigins.includes(origin)) {
return callback(null, true);
}


  return callback(new Error("Origin not allowed by CORS"));
},
methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
allowedHeaders: ["Content-Type", "Authorization"],


})
);

app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
res.status(200).json({
message: "MaintainIt API is running",
});
});

app.use("/api/users", userRoutes);
app.use("/api/tenant-assignments", tenantAssignmentRoutes);
app.use("/api/maintenance-requests", maintenanceRequestRoutes);
app.use("/api/maintenance-responsibilities", maintenanceResponsibilityRoutes);
app.use("/api/maintenance-assignments", maintenanceAssignmentRoutes);
app.use("/api/maintenance-history", maintenanceHistoryRoutes);
app.use("/api/payments", paymentRoutes);

// Handle malformed JSON and other request errors.
app.use((error, req, res, next) => {
if (res.headersSent) {
return next(error);
}

if (
error instanceof SyntaxError &&
error.status === 400 &&
"body" in error
) {
return res.status(400).json({
message: "Invalid JSON request body.",
});
}

if (error.message === "Origin not allowed by CORS") {
return res.status(403).json({
message: "This origin is not permitted to access the API.",
});
}

console.error("Unhandled request error:", error);

return res.status(500).json({
message: "An unexpected server error occurred.",
});
});

async function startServer() {
try {
if (
!process.env.DB_HOST ||
!process.env.DB_NAME ||
!process.env.DB_USER ||
!process.env.DB_PASSWORD ||
!process.env.JWT_SECRET
) {
throw new Error(
"A required database or authentication environment variable is missing."
);
}


await pool.query("SELECT NOW()");
console.log("Database connection verified.");

const server = app.listen(PORT, () => {
  console.log(`MaintainIt API running on port ${PORT}`);
  console.log("Allowed frontend origins:", allowedOrigins);
});

server.on("error", (error) => {
  console.error("HTTP server error:", error);
  process.exitCode = 1;
});

startOverdueMaintenanceScheduler();

let shuttingDown = false;

const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`${signal} received. Shutting down MaintainIt...`);

  server.close(async () => {
    try {
      await pool.end();
      process.exitCode = 0;
    } catch (error) {
      console.error("Database shutdown error:", error);
      process.exitCode = 1;
    }
  });
};

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));


} catch (error) {
console.error("MaintainIt startup failed:", error.message);


await pool.end().catch(() => {});
process.exitCode = 1;


}
}

startServer();
