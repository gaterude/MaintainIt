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

const {
  startOverdueMaintenanceScheduler,
} = require("./jobs/overdueMaintenanceScheduler");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "MaintainIt API is running",
  });
});

app.use("/api/users", userRoutes);

app.use(
  "/api/maintenance-requests",
  maintenanceRequestRoutes
);

app.use(
  "/api/maintenance-responsibilities",
  maintenanceResponsibilityRoutes
);

app.use(
  "/api/maintenance-assignments",
  maintenanceAssignmentRoutes
);

app.use(
  "/api/maintenance-history",
  maintenanceHistoryRoutes
);

app.use("/api/payments", paymentRoutes);

pool.query("SELECT NOW()", (error, result) => {
  if (error) {
    console.error(
      "Database connection failed:",
      error
    );
    return;
  }

  console.log(
    "Database connected:",
    result.rows[0]
  );

  // Start the overdue maintenance scheduler
  // only after the database connection succeeds.
  startOverdueMaintenanceScheduler();
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(
    `MaintainIt API running on port ${PORT}`
  );
});