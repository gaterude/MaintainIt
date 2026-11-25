const recovery = require("../services/paymentRecoveryService");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function handler(cancel) {
  return async (req, res) => {
    const { requestId } = req.params;

    if (!UUID.test(requestId)) {
      return res.status(400).json({ message: "Invalid request ID." });
    }

    try {
      const result = await recovery.resolveMpesaPayment({
        requestId,
        user: req.user,
        cancel,
      });
      return res.status(200).json(result);
    } catch (error) {
      const status = error.status || 500;
      if (status === 500) console.error("Payment recovery error:", error);
      return res.status(status).json({
        message: status === 500 ? "Unable to check the payment." : error.message,
      });
    }
  };
}

module.exports = {
  checkMpesaStatus: handler(false),
  cancelMpesaAttempt: handler(true),
};