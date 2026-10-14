const cron = require("node-cron");

const {
  checkOverdueMaintenance,
} = require("../services/overdueMaintenanceService");

function startOverdueMaintenanceScheduler() {
  console.log(
    "Registering overdue maintenance scheduler..."
  );

  // Run once when the server starts.
  checkOverdueMaintenance().catch((error) => {
    console.error(
      "Initial overdue maintenance check failed:",
      error.message
    );
  });

  // Run every 15 minutes using Kenya's timezone.
  cron.schedule(
    "*/15 * * * *",
    () => {
      checkOverdueMaintenance().catch((error) => {
        console.error(
          "Scheduled overdue maintenance check failed:",
          error.message
        );
      });
    },
    {
      timezone: "Africa/Nairobi",
    }
  );

  console.log(
    "Overdue maintenance scheduler started. Checks run every 15 minutes."
  );
}

module.exports = {
  startOverdueMaintenanceScheduler,
};