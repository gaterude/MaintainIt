const maintenanceResponsibilityRepository =
require("../repositories/maintenanceResponsibilityRepository");

const maintenanceRequestRepository =
require("../repositories/maintenanceRequestRepository");

const { sendSms } = require("./smsService");

async function decideResponsibility({
requestId,
responsibleParty,
reason,
repairCostKes,
decidedBy,
}) {
if (!requestId) {
throw new Error("Maintenance request ID is required");
}

if (!["tenant", "admin"].includes(responsibleParty)) {
throw new Error("Responsible party must be tenant or admin");
}

if (!reason || reason.trim().length === 0) {
throw new Error(
"A reason is required for the responsibility decision"
);
}

if (
repairCostKes === undefined ||
repairCostKes === null ||
repairCostKes === "" ||
!Number.isFinite(Number(repairCostKes)) ||
Number(repairCostKes) <= 0
) {
throw new Error("Repair cost must be a number greater than zero");
}

if (!Number.isInteger(Number(repairCostKes))) {
throw new Error(
"Repair cost must be entered as a whole amount in KES"
);
}

const repairCostCents = Math.round(
Number(repairCostKes) * 100
);

// Save the responsibility decision first.
const responsibility =
await maintenanceResponsibilityRepository.createResponsibility({
requestId,
responsibleParty,
reason: reason.trim(),
repairCostCents,
decidedBy,
});

// Notify the tenant after the decision has been saved.
try {
const requestDetails =
await maintenanceRequestRepository.findRequestDetails(
requestId
);


if (!requestDetails) {
  console.warn(
    `Request ${requestId} not found for responsibility SMS notification.`
  );

  return responsibility;
}

if (!requestDetails.tenant_phone) {
  console.warn(
    `No tenant phone number found for request ${requestId}. SMS skipped.`
  );

  return responsibility;
}

const responsibleLabel =
  responsibleParty === "tenant"
    ? "Tenant"
    : "Property administration";

const repairCost = Number(repairCostKes).toLocaleString(
  "en-KE"
);

const message =
  `MaintainIt: Responsibility decision for ` +
  `${requestDetails.title || "your maintenance request"}. ` +
  `Responsible party: ${responsibleLabel}. ` +
  `Reason: ${reason.trim()}. ` +
  `Repair cost: KES ${repairCost}.`;

await sendSms({
  phoneNumber: requestDetails.tenant_phone,
  message,
});

console.log(
  `Responsibility decision SMS processed for request ${requestId}.`
);


} catch (error) {
console.error(
`Could not send responsibility decision SMS for request ${requestId}:`,
error.message
);
}

return responsibility;
}

module.exports = {
decideResponsibility,
};
