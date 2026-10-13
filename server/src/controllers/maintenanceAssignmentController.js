const maintenanceAssignmentService = require("../services/maintenanceAssignmentService");

async function assignFundi(req, res) {
  try {
    const {
      requestId,
      fundiId,
    } = req.body;

    if (!requestId || !fundiId) {
      return res.status(400).json({
        message: "Request ID and fundi ID are required",
      });
    }

    const result =
      await maintenanceAssignmentService.assignFundi({
        requestId,
        fundiId,
        assignedBy: req.user.id,
      });

    res.status(201).json({
      message: "Fundi assigned successfully",
      result,
    });
  } catch (error) {
    console.error("Assign fundi error:", error);

    res.status(400).json({
      message: error.message,
    });
  }
}

async function getFundiAssignments(req, res) {
  try {
    const assignments =
      await maintenanceAssignmentService.getFundiAssignments(
        req.user.id
      );

    res.status(200).json({
      assignments,
    });
  } catch (error) {
    console.error(
      "Get fundi assignments error:",
      error
    );

    res.status(500).json({
      message: "Failed to retrieve fundi assignments",
    });
  }
}

async function acceptJob(req, res) {
  try {
    const { requestId } = req.body;

    if (!requestId) {
      return res.status(400).json({
        message: "Request ID is required",
      });
    }

    const request =
      await maintenanceAssignmentService.acceptJob({
        requestId,
        fundiId: req.user.id,
      });

    res.status(200).json({
      message: "Maintenance job accepted",
      request,
    });
  } catch (error) {
    console.error("Accept job error:", error);

    res.status(400).json({
      message: error.message,
    });
  }
}

async function completeJob(req, res) {
  try {
    const { requestId } = req.body;

    if (!requestId) {
      return res.status(400).json({
        message: "Request ID is required",
      });
    }

    const request =
      await maintenanceAssignmentService.completeJob({
        requestId,
        fundiId: req.user.id,
      });

    res.status(200).json({
      message: "Maintenance job completed",
      request,
    });
  } catch (error) {
    console.error("Complete job error:", error);

    res.status(400).json({
      message: error.message,
    });
  }
}

module.exports = {
  assignFundi,
  getFundiAssignments,
  acceptJob,
  completeJob,
};