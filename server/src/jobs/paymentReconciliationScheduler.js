const cron = require("node-cron");
const {
  reconcileUnresolvedPayments,
} = require("../services/paymentReconciliationService");

let isRunning = false;

async function runPaymentReconciliation() {
  if (isRunning) {
    console.log(
      "Payment reconciliation skipped: previous run is still active."
    );
    return;
  }

  isRunning = true;

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
  }
}

function startPaymentReconciliationScheduler() {
  console.log("Registering payment reconciliation scheduler...");

  cron.schedule(
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

module.exports = {
  startPaymentReconciliationScheduler,
};