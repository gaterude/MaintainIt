const paymentService = require("../services/paymentService");
const paymentRepository = require("../repositories/paymentRepository");

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

    if (error.code === "PAYMENT_ATTEMPT_IN_PROGRESS") {
      return res.status(409).json({
        message: error.message,
      });
    }

    return res.status(400).json({
      message: error.message,
    });
  }
}

async function initiateCashPayment(req, res) {
  try {
    const { requestId } = req.body;

    if (!requestId) {
      return res.status(400).json({
        message: "Request ID is required",
      });
    }

    const payment = await paymentService.initiateCashPayment({
      requestId,
      payerId: req.user.id,
    });

    return res.status(201).json({
      message: "Cash payment recorded as pending",
      payment,
    });
  } catch (error) {
    console.error("Cash payment initiation error:", error);

    if (error.code === "PAYMENT_ATTEMPT_IN_PROGRESS") {
      return res.status(409).json({
        message: error.message,
      });
    }

    return res.status(400).json({
      message: error.message,
    });
  }
}

async function confirmCashPayment(req, res) {
  try {
    const { paymentId } = req.params;

    if (!paymentId) {
      return res.status(400).json({
        message: "Payment ID is required",
      });
    }

    const payment = await paymentRepository.confirmCashPayment({
      paymentId,
      fundiId: req.user.id,
    });

    return res.status(200).json({
      message: "Cash payment confirmed successfully",
      payment,
    });
  } catch (error) {
    console.error("Cash payment confirmation error:", error);

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

    return res.status(200).json({
      message: "Callback received",
    });
  }
}

module.exports = {
  initiatePayment,
  initiateCashPayment,
  confirmCashPayment,
  handleCallback,
};
