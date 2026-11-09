const paymentRepository = require("../repositories/paymentRepository");

async function listUnresolvedMpesaPayments(req, res) {
  try {
    const limit =
      req.query.limit === undefined
        ? 100
        : Number(req.query.limit);

    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 500
    ) {
      return res.status(400).json({
        message: "Limit must be a whole number between 1 and 500.",
      });
    }

    const payments =
      await paymentRepository.findUnresolvedMpesaPaymentsForAdmin(
        limit
      );

    return res.status(200).json({
      message: "Unresolved M-Pesa payments retrieved successfully.",
      count: payments.length,
      payments,
    });
  } catch (error) {
    console.error(
      "Admin unresolved payments error:",
      error
    );

    return res.status(500).json({
      message: "Unable to load unresolved M-Pesa payments.",
    });
  }
}

module.exports = {
  listUnresolvedMpesaPayments,
};