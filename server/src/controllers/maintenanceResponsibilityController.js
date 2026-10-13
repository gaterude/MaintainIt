const maintenanceResponsibilityService = require("../services/maintenanceResponsibilityService");

async function decideResponsibility(req, res) {
  try {
    const {
      requestId,
      responsibleParty,
      reason,
      repairCostKes,
    } = req.body;

    if (
      !requestId ||
      !responsibleParty ||
      !reason ||
      repairCostKes === undefined ||
      repairCostKes === null ||
      repairCostKes === ""
    ) {
      return res.status(400).json({
        message:
          "Request ID, responsible party, reason and repair cost are required",
      });
    }

    const result =
      await maintenanceResponsibilityService.decideResponsibility({
        requestId,
        responsibleParty,
        reason,
        repairCostKes,
        decidedBy: req.user.id,
      });

    return res.status(201).json({
      message: "Maintenance responsibility decided successfully",
      result,
    });
  } catch (error) {
    console.error("Decide responsibility error:", error);

    return res.status(400).json({
      message: error.message,
    });
  }
}

module.exports = { decideResponsibility };
