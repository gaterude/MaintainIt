const appointmentRepository = require("../repositories/appointmentRepository");
const appointmentService = require("../services/appointmentService");
const whatsappService = require("../services/whatsappService");

function safeEqualText(left, right) {
  if (
    typeof left !== "string" ||
    typeof right !== "string"
  ) {
    return false;
  }

  const a = Buffer.from(left);
  const b = Buffer.from(right);

  return (
    a.length === b.length &&
    require("crypto").timingSafeEqual(a, b)
  );
}

function getSenderPhoneCandidates(phoneNumber) {
  let normalized;

  try {
    normalized = whatsappService.normalizePhoneNumber(phoneNumber);
  } catch {
    return [];
  }

  const candidates = new Set([normalized]);

  if (normalized.startsWith("254")) {
    candidates.add(`0${normalized.slice(3)}`);
  } else if (normalized.startsWith("0")) {
    candidates.add(`254${normalized.slice(1)}`);
  }

  return [...candidates];
}

function verifyWebhook(req, res) {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!verifyToken) {
    return res.status(503).send("WhatsApp webhook is not configured.");
  }

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (
    mode === "subscribe" &&
    safeEqualText(token, verifyToken) &&
    typeof challenge === "string"
  ) {
    return res.status(200).type("text/plain").send(challenge);
  }

  return res.status(403).send("Webhook verification failed.");
}

function getReplyPayload(message) {
  return (
    message?.button?.payload ||
    message?.interactive?.button_reply?.id ||
    null
  );
}

async function processAppointmentReply(message) {
  const buttonPayload = getReplyPayload(message);

  if (!buttonPayload) {
    return;
  }

  const action =
    whatsappService.parseActionPayload(buttonPayload);

  if (!action) {
    console.warn("Ignored an invalid WhatsApp appointment action.");
    return;
  }

  const senderPhones = getSenderPhoneCandidates(message.from);

  if (senderPhones.length === 0) {
    console.warn("Ignored a WhatsApp response with an invalid sender.");
    return;
  }

  const appointment =
    await appointmentRepository.findAppointmentForWhatsAppAction({
      appointmentId: action.appointmentId,
      senderPhones,
    });

  if (!appointment) {
    console.warn(
      "Ignored a WhatsApp response that did not match an opted-in tenant and appointment."
    );
    return;
  }

  const currentVisitTime = new Date(
    appointment.proposed_visit_at
  ).getTime();

  const signedVisitTime = new Date(
    action.proposedVisitAt
  ).getTime();

  if (
    !Number.isFinite(currentVisitTime) ||
    currentVisitTime !== signedVisitTime
  ) {
    console.warn("Ignored a reply to an outdated appointment proposal.");
    return;
  }

  const updatedAppointment =
    await appointmentService.respondToAppointment({
      appointmentId: appointment.id,
      tenantUserId: appointment.tenant_user_id,
      response: action.response,
      note: null,
      expectedProposedVisitAt: action.proposedVisitAt,
    });

  const acknowledgement =
    action.response === "confirm"
      ? "Thank you. Your MaintainIt visit appointment is confirmed."
      : "Your request to reschedule has been recorded. Your fundi will propose another time.";

  try {
    await whatsappService.sendTextMessage({
      phoneNumber: message.from,
      message: acknowledgement,
    });
  } catch (error) {
    // The appointment response is already saved. Do not undo it
    // because a confirmation message could not be delivered.
    console.error(
      "Unable to send the WhatsApp response acknowledgement:",
      error.message
    );
  }

  console.info(
    "WhatsApp appointment response processed:",
    updatedAppointment.id,
    updatedAppointment.status
  );
}

async function receiveWebhook(req, res) {
  const rawBody = req.rawBody;

  if (!process.env.WHATSAPP_APP_SECRET) {
    return res.status(503).json({
      message: "WhatsApp webhook signature verification is not configured.",
    });
  }

  if (
    !Buffer.isBuffer(rawBody) ||
    !whatsappService.verifyWebhookSignature(
      rawBody,
      req.get("x-hub-signature-256")
    )
  ) {
    return res.status(401).json({
      message: "Invalid WhatsApp webhook signature.",
    });
  }

  let payload;

  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({
      message: "Invalid WhatsApp webhook payload.",
    });
  }

  try {
    const messages = [];

    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        for (const message of change.value?.messages || []) {
          messages.push(message);
        }
      }
    }

    for (const message of messages) {
      await processAppointmentReply(message);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error(
      "WhatsApp webhook processing failed:",
      error.message
    );

    return res.status(500).json({
      message: "Unable to process the WhatsApp response.",
    });
  }
}

module.exports = {
  verifyWebhook,
  receiveWebhook,
};