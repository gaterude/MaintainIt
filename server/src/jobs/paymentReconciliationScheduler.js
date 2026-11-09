const cron = require("node-cron");

const {
  reconcileUnresolvedPayments,
} = require("../services/paymentReconciliationService");

let scheduledTask = null;
let isRunning = false;
let activeRun = null;
let isStopping = false;

async function runPaymentReconciliation() {
  if (isStopping) {
    return;
  }

  if (isRunning) {
    console.log(
      "Payment reconciliation skipped: previous run is still active."
    );
    return activeRun;
  }

  isRunning = true;

  activeRun = (async () => {
    try {
      const result = await reconcileUnresolvedPayments(10);

      console.log(
        JSON.stringify({
          event: "payment_reconciliation_completed",
          checked: result.checked,
          outcomes: result.results.map((item) => ({
            paymentId: item.paymentId,
            outcome: item.outcome,
            currentStatus: item.currentStatus || item.status,
          })),
        })
      );
    } catch (error) {
      console.error(
        "Payment reconciliation failed:",
        error.message
      );
    } finally {
      isRunning = false;
      activeRun = null;
    }
  })();

  return activeRun;
}

function startPaymentReconciliationScheduler() {
  console.log("Registering payment reconciliation scheduler...");

  isStopping = false;

  scheduledTask = cron.schedule(
    "*/10 * * * *",
    runPaymentReconciliation,
    {
      timezone: "Africa/Nairobi",
    }
  );

  console.log(
    "Payment reconciliation scheduler started. Checks run every 10 minutes."
  );
}

async function stopPaymentReconciliationScheduler() {
  isStopping = true;

  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }

  if (activeRun) {
    await activeRun;
  }

  console.log("Payment reconciliation scheduler stopped.");
}

module.exports = {
  startPaymentReconciliationScheduler,
  stopPaymentReconciliationScheduler,
};