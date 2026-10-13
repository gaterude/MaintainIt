const paymentRepository = require("../repositories/paymentRepository");
const maintenanceRequestRepository = require("../repositories/maintenanceRequestRepository");
const maintenanceResponsibilityRepository = require("../repositories/maintenanceResponsibilityRepository");

const MPESA_BASE_URL =
  process.env.MPESA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

async function getAccessToken() {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    throw new Error("M-Pesa consumer credentials are not set");
  }

  const credentials = Buffer.from(
    `${consumerKey}:${consumerSecret}`
  ).toString("base64");

  let response;

  try {
    response = await fetch(
      `${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${credentials}`,
        },
      }
    );
  } catch (error) {
    console.error("M-Pesa OAuth request failed:", error.message);
    throw new Error("Could not connect to M-Pesa");
  }

  const data = await response.json();

  console.log("M-Pesa OAuth response:", {
    status: response.status,
    tokenReceived: !!data.access_token,
    tokenLength: data.access_token ? data.access_token.length : 0,
    expiresIn: data.expires_in || null,
    error: data.errorMessage || data.error_description || null,
  });

  if (!response.ok || !data.access_token) {
    throw new Error(
      data.errorMessage ||
        data.error_description ||
        "Failed to get M-Pesa access token"
    );
  }

  return data.access_token;
}

function generateTimestamp() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

async function initiateSTKPush({
  phoneNumber,
  amount,
  accountReference,
  transactionDesc,
}) {
  const accessToken = await getAccessToken();

  const businessShortCode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;
  const callbackUrl = process.env.MPESA_CALLBACK_URL;

  if (!businessShortCode || !passkey || !callbackUrl) {
    throw new Error("M-Pesa STK configuration is incomplete");
  }

  const timestamp = generateTimestamp();

  const password = Buffer.from(
    `${businessShortCode}${passkey}${timestamp}`
  ).toString("base64");

  let response;

  try {
    response = await fetch(
      `${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          BusinessShortCode: businessShortCode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: "CustomerPayBillOnline",
          Amount: Number(amount),
          PartyA: phoneNumber,
          PartyB: businessShortCode,
          PhoneNumber: phoneNumber,
          CallBackURL: callbackUrl,
          AccountReference: accountReference,
          TransactionDesc: transactionDesc,
        }),
      }
    );
  } catch (error) {
    console.error("M-Pesa STK request failed:", error.message);
    throw new Error("Could not connect to M-Pesa STK service");
  }

  const data = await response.json();

  if (!response.ok || data.ResponseCode !== "0") {
    console.error("M-Pesa STK response:", data);

    throw new Error(
      data.errorMessage ||
        data.ResponseDescription ||
        "M-Pesa STK Push failed"
    );
  }

  return data;
}

async function initiatePayment({
  requestId,
  payerId,
  phoneNumber,
}) {
  const request =
    await maintenanceRequestRepository.findRequestById(requestId);

  if (!request) {
    throw new Error("Maintenance request not found");
  }

  if (request.status !== "completed") {
    throw new Error(
      "Payment can only be initiated after the repair is completed"
    );
  }

  const responsibility =
    await maintenanceResponsibilityRepository.findResponsibilityByRequestId(
      requestId
    );

  if (!responsibility) {
    throw new Error(
      "No responsibility decision exists for this maintenance request"
    );
  }

  if (
    !Number.isInteger(responsibility.repair_cost_cents) ||
    responsibility.repair_cost_cents <= 0
  ) {
    throw new Error(
      "A valid repair cost has not been recorded for this request"
    );
  }

  if (responsibility.responsible_party === "tenant") {
    const tenantResult = await require("../config/database").query(
      `SELECT id
       FROM tenants
       WHERE user_id = $1`,
      [payerId]
    );

    if (
      tenantResult.rows.length === 0 ||
      tenantResult.rows[0].id !== request.tenant_id
    ) {
      throw new Error(
        "Only the tenant responsible for this repair can initiate its payment"
      );
    }
  } else if (responsibility.responsible_party === "admin") {
    const userResult = await require("../config/database").query(
      `SELECT role
       FROM users
       WHERE id = $1`,
      [payerId]
    );

    if (
      userResult.rows.length === 0 ||
      userResult.rows[0].role !== "admin"
    ) {
      throw new Error(
        "Only an admin can initiate payment for this repair"
      );
    }
  } else {
    throw new Error("Invalid responsible party");
  }

  const amountCents = responsibility.repair_cost_cents;
  const amountKes = amountCents / 100;

  if (!Number.isInteger(amountKes)) {
    throw new Error(
      "The saved repair cost must be a whole KES amount for M-Pesa"
    );
  }

  const payment = await paymentRepository.createPayment({
    maintenanceRequestId: requestId,
    payerId,
    amountCents,
  });

  try {
    const stkResponse = await initiateSTKPush({
      phoneNumber,
      amount: amountKes,
      accountReference: `MaintainIt-${requestId}`,
      transactionDesc: "MaintainIt maintenance payment",
    });

    const updatedPayment =
      await paymentRepository.attachCheckoutRequestId(
        payment.id,
        stkResponse.CheckoutRequestID
      );

    return {
      payment: updatedPayment,
      stkResponse,
    };
  } catch (error) {
    await paymentRepository.markPaymentFailed(payment.id);
    throw error;
  }
}

async function handleCallback(callbackData) {
  const stkCallback = callbackData?.Body?.stkCallback;

  if (!stkCallback) {
    throw new Error("Invalid M-Pesa callback");
  }

  const checkoutRequestId = stkCallback.CheckoutRequestID;
  const resultCode = stkCallback.ResultCode;

  const payment =
    await paymentRepository.findPaymentByCheckoutRequestId(
      checkoutRequestId
    );

  if (!payment) {
    throw new Error(
      "Payment for this M-Pesa checkout request was not found"
    );
  }

  if (payment.status === "paid") {
    return payment;
  }

  if (Number(resultCode) !== 0) {
  return paymentRepository.markPaymentFailed(payment.id);
}

  const metadata = stkCallback.CallbackMetadata?.Item || [];

  const receiptItem = metadata.find(
    (item) => item.Name === "MpesaReceiptNumber"
  );

  const transactionReference = receiptItem?.Value;

  if (!transactionReference) {
    throw new Error(
      "M-Pesa callback did not contain a transaction reference"
    );
  }

  return paymentRepository.markPaymentPaid({
    paymentId: payment.id,
    transactionReference,
  });
}

module.exports = {
  initiatePayment,
  handleCallback,
};
