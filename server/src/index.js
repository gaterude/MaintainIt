const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
});

const pool = require("./config/database");

const userRoutes = require("./routes/userRoutes");
const maintenanceRequestRoutes = require("./routes/maintenanceRequestRoutes");
const maintenanceResponsibilityRoutes = require("./routes/maintenanceResponsibilityRoutes");
const maintenanceAssignmentRoutes = require("./routes/maintenanceAssignmentRoutes");
const maintenanceHistoryRoutes = require("./routes/maintenanceHistoryRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const whatsappWebhookRoutes = require("./routes/whatsappWebhookRoutes");
const whatsappPreferenceRoutes = require("./routes/whatsappPreferenceRoutes");
const tenantAssignmentRoutes = require("./routes/tenantAssignmentRoutes");

const {
  startOverdueMaintenanceScheduler,
  stopOverdueMaintenanceScheduler,
} = require("./jobs/overdueMaintenanceScheduler");

const {
  startPaymentReconciliationScheduler,
  stopPaymentReconciliationScheduler,
} = require("./jobs/paymentReconciliationScheduler");

const app = express();
const PORT = Number(process.env.PORT) || 4000;

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    message: "Too many requests. Please try again later.",
  },
});

const allowedOrigins = (
process.env.CLIENT_URL || "http://localhost:5173"
)
.split(",")
.map((origin) => origin.trim())
.filter(Boolean);

app.disable("x-powered-by");

const helmetOptions =
  process.env.NODE_ENV === "production"
    ? {}
    : { strictTransportSecurity: false };

app.use(helmet(helmetOptions));

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

app.use("/api", apiLimiter);
app.use(express.json({
    limit: "1mb",
    verify(req, res, buffer) {
      if (
        req.originalUrl.split("?")[0] ===
        "/api/webhooks/whatsapp"
      ) {
        req.rawBody = Buffer.from(buffer);
      }
    },
  })
);

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
app.use("/api/appointments", appointmentRoutes);
app.use("/api/webhooks/whatsapp", whatsappWebhookRoutes);
app.use("/api/whatsapp-preferences", whatsappPreferenceRoutes);
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
  // Start background jobs only after the server successfully binds its port.
  startOverdueMaintenanceScheduler();
  startPaymentReconciliationScheduler();
});

server.on("error", (error) => {
  console.error("HTTP server error:", error);
  process.exitCode = 1;
});


let shuttingDown = false;

const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`${signal} received. Shutting down MaintainIt...`);

  // Stop scheduled jobs and wait for any active checks to finish.
  const schedulerShutdown = Promise.all([
    stopOverdueMaintenanceScheduler(),
    stopPaymentReconciliationScheduler(),
  ]);

  // Stop accepting new HTTP requests and wait for existing requests.
  server.close(async () => {
    try {
      await schedulerShutdown;
      await pool.end();

      console.log("Database connection pool closed.");
      process.exitCode = 0;
    } catch (error) {
      console.error("Shutdown error:", error);
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
