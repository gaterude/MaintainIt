
const paymentService = require("../services/paymentService");

async function initiatePayment(req, res) {
  try {
    const { requestId, phoneNumber } = req.body;

    if (!requestId || !phoneNumber) {
      return res.status(400).json({
        message: "Request ID and phone number are required",
      });
    }

    const result = await paymentService.initiatePayment({
      requestId,
      payerId: req.user.id,
      phoneNumber,
    });

    return res.status(201).json({
      message: "M-Pesa payment initiated",
      result,
    });
  } catch (error) {
    console.error("Initiate payment error:", error);

    return res.status(400).json({
      message: error.message,
    });
  }
}

async function handleCallback(req, res) {
  try {
    await paymentService.handleCallback(req.body);

    return res.status(200).json({
      message: "Callback processed successfully",
    });
  } catch (error) {
    console.error("M-Pesa callback error:", error);

    // Acknowledge receipt so callback errors do not trigger
    // unnecessary repeated callback attempts.
    return res.status(200).json({
      message: "Callback received",
    });
  }
}

module.exports = {
  initiatePayment,
  handleCallback,
};
