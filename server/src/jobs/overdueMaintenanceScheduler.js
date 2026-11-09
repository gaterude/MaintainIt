const cron = require("node-cron");

const {
  checkOverdueMaintenance,
} = require("../services/overdueMaintenanceService");

let scheduledTask = null;
let activeCheck = null;
let isStopping = false;

function runOverdueCheck(label) {
  if (isStopping) {
    return Promise.resolve();
  }

  // Prevent overlapping overdue checks.
  if (activeCheck) {
    console.log(
      "Overdue maintenance check skipped: previous check is still running."
    );

    return activeCheck;
  }

  const checkPromise = checkOverdueMaintenance()
    .catch((error) => {
      console.error(
        `${label} failed:`,
        error.message
      );
    })
    .finally(() => {
      activeCheck = null;
    });

  activeCheck = checkPromise;

  return checkPromise;
}

function startOverdueMaintenanceScheduler() {
  console.log(
    "Registering overdue maintenance scheduler..."
  );

  isStopping = false;

  // Run once when the server starts.
  runOverdueCheck("Initial overdue maintenance check");

  // Run every 15 minutes using Kenya's timezone.
  scheduledTask = cron.schedule(
    "*/15 * * * *",
    () => {
      runOverdueCheck("Scheduled overdue maintenance check");
    },
    {
      timezone: "Africa/Nairobi",
    }
  );

  console.log(
    "Overdue maintenance scheduler started. Checks run every 15 minutes."
  );
}

async function stopOverdueMaintenanceScheduler() {
  isStopping = true;

  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }

  // Allow an existing database operation to finish.
  if (activeCheck) {
    await activeCheck;
  }

  console.log("Overdue maintenance scheduler stopped.");
}

module.exports = {
  startOverdueMaintenanceScheduler,
  stopOverdueMaintenanceScheduler,
};