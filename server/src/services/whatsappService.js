const crypto = require("crypto");

function getGraphVersion() {
  const configured = process.env.WHATSAPP_GRAPH_API_VERSION || "v26.0";
  return configured.startsWith("v") ? configured : `v${configured}`;
}

function normalizePhoneNumber(value) {
  let digits = String(value || "").replace(/\D/g, "");

  // Convert common Kenyan local numbers to international format.
  if (digits.startsWith("0")) {
    digits = `254${digits.slice(1)}`;
  }

  if (digits.length < 10 || digits.length > 15) {
    throw new Error("The WhatsApp recipient phone number is invalid.");
  }

  return digits;
}

function createActionPayload({
  appointmentId,
  response,
  proposedVisitAt,
}) {
  const secret = process.env.WHATSAPP_ACTION_SECRET;

  if (!secret) {
    throw new Error("WhatsApp action-signing configuration is missing.");
  }

  if (!["confirm", "reschedule"].includes(response)) {
    throw new Error("Invalid WhatsApp appointment action.");
  }

  const visitTimestamp = new Date(proposedVisitAt).getTime();

  if (!Number.isFinite(visitTimestamp)) {
    throw new Error("The appointment visit date is invalid.");
  }

  const timestampToken = visitTimestamp.toString(36);
  const unsignedPayload =
    `v1.${appointmentId}.${response}.${timestampToken}`;

  const signature = crypto
    .createHmac("sha256", secret)
    .update(unsignedPayload)
    .digest("base64url");

  return `${unsignedPayload}.${signature}`;
}

function parseActionPayload(payload) {
  if (typeof payload !== "string") {
    return null;
  }

  const match = payload.match(
    /^v1\.([0-9a-f-]{36})\.(confirm|reschedule)\.([a-z0-9]+)\.([A-Za-z0-9_-]+)$/i
  );

  if (!match) {
    return null;
  }

  const [, appointmentId, response, timestampToken, providedSignature] =
    match;

  const secret = process.env.WHATSAPP_ACTION_SECRET;

  if (!secret) {
    return null;
  }

  const unsignedPayload =
    `v1.${appointmentId}.${response}.${timestampToken}`;

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(unsignedPayload)
    .digest("base64url");

  const expectedBuffer = Buffer.from(expectedSignature);
  const providedBuffer = Buffer.from(providedSignature);

  if (
    expectedBuffer.length !== providedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    return null;
  }

  const visitTimestamp = Number.parseInt(timestampToken, 36);

  if (!Number.isFinite(visitTimestamp)) {
    return null;
  }

  return {
    appointmentId,
    response,
    proposedVisitAt: new Date(visitTimestamp).toISOString(),
  };
}

function verifyWebhookSignature(rawBody, signatureHeader) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  if (
    !appSecret ||
    !Buffer.isBuffer(rawBody) ||
    typeof signatureHeader !== "string"
  ) {
    return false;
  }

  const match = signatureHeader.match(/^sha256=([a-f0-9]{64})$/i);

  if (!match) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest();

  const provided = Buffer.from(match[1], "hex");

  return (
    expected.length === provided.length &&
    crypto.timingSafeEqual(expected, provided)
  );
}

function formatVisitDate(proposedVisitAt) {
  const date = new Date(proposedVisitAt);

  if (Number.isNaN(date.getTime())) {
    throw new Error("The appointment visit date is invalid.");
  }

  return {
    date: new Intl.DateTimeFormat("en-KE", {
      dateStyle: "long",
      timeZone: "Africa/Nairobi",
    }).format(date),

    time: new Intl.DateTimeFormat("en-KE", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Africa/Nairobi",
    }).format(date),
  };
}

async function sendAppointmentProposal({
  phoneNumber,
  tenantName,
  appointmentId,
  proposedVisitAt,
  optedIn,
}) {
  // Do not send business messages without the tenant's consent.
  if (optedIn !== true) {
    return {
      sent: false,
      reason: "tenant_not_opted_in",
    };
  }

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName =
    process.env.WHATSAPP_APPOINTMENT_TEMPLATE_NAME;
  const actionSecret = process.env.WHATSAPP_ACTION_SECRET;

  if (!accessToken || !phoneNumberId || !templateName || !actionSecret) {
    return {
      sent: false,
      reason: "whatsapp_not_configured",
    };
  }

  const recipient = normalizePhoneNumber(phoneNumber);
  const visit = formatVisitDate(proposedVisitAt);

  const confirmPayload = createActionPayload({
    appointmentId,
    response: "confirm",
    proposedVisitAt,
  });

  const reschedulePayload = createActionPayload({
    appointmentId,
    response: "reschedule",
    proposedVisitAt,
  });

  const requestBody = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipient,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en",
      },
      components: [
        {
          type: "body",
          parameters: [
            {
              type: "text",
              text: tenantName || "Tenant",
            },
            {
              type: "text",
              text: visit.date,
            },
            {
              type: "text",
              text: visit.time,
            },
          ],
        },
        {
          type: "button",
          sub_type: "quick_reply",
          index: "0",
          parameters: [
            {
              type: "payload",
              payload: confirmPayload,
            },
          ],
        },
        {
          type: "button",
          sub_type: "quick_reply",
          index: "1",
          parameters: [
            {
              type: "payload",
              payload: reschedulePayload,
            },
          ],
        },
      ],
    },
  };

  const version = getGraphVersion();
  const endpoint =
    `https://graph.facebook.com/${version}/${encodeURIComponent(phoneNumberId)}/messages`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(15000),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("WhatsApp message rejected by API.", {
      status: response.status,
      errorCode: result?.error?.code,
      errorType: result?.error?.type,
    });

    throw new Error(
      `WhatsApp message failed with HTTP ${response.status}.`
    );
  }

  return {
    sent: true,
    messageId: result?.messages?.[0]?.id || null,
  };
}

async function sendTextMessage({ phoneNumber, message }) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    return {
      sent: false,
      reason: "whatsapp_not_configured",
    };
  }

  const recipient = normalizePhoneNumber(phoneNumber);

  const response = await fetch(
    `https://graph.facebook.com/${getGraphVersion()}/${encodeURIComponent(phoneNumberId)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "text",
        text: {
          preview_url: false,
          body: message,
        },
      }),
      signal: AbortSignal.timeout(15000),
    }
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("WhatsApp acknowledgement failed.", {
      status: response.status,
      errorCode: result?.error?.code,
    });

    throw new Error(
      `WhatsApp acknowledgement failed with HTTP ${response.status}.`
    );
  }

  return {
    sent: true,
    messageId: result?.messages?.[0]?.id || null,
  };
}

module.exports = {
  normalizePhoneNumber,
  createActionPayload,
  parseActionPayload,
  verifyWebhookSignature,
  sendAppointmentProposal,
  sendTextMessage,
};
