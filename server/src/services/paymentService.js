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
    console.error("M-Pesa STK request outcome is uncertain:", error.message);

    const uncertainError = new Error(
      "M-Pesa did not return a response. The payment outcome is uncertain; check its status before trying again."
    );

    uncertainError.paymentOutcomeUncertain = true;

    throw uncertainError;
  }

  let data;

  try {
    data = await response.json();
  } catch (error) {
    console.error(
      "Could not read the M-Pesa STK response:",
      error.message
    );

    const uncertainError = new Error(
      "M-Pesa returned an unreadable response. Check the payment status before trying again."
    );

    uncertainError.paymentOutcomeUncertain = true;

    throw uncertainError;
  }

  if (!response.ok || data.ResponseCode !== "0") {
    console.error("M-Pesa STK response:", {
      status: response.status,
      responseCode: data.ResponseCode,
      responseDescription: data.ResponseDescription,
      errorMessage: data.errorMessage,
    });

    const rejectionError = new Error(
      data.errorMessage ||
        data.ResponseDescription ||
        "M-Pesa STK Push was rejected"
    );

    rejectionError.paymentRejected = true;

    throw rejectionError;
  }

  if (
    typeof data.CheckoutRequestID !== "string" ||
    !data.CheckoutRequestID.trim()
  ) {
    const uncertainError = new Error(
      "M-Pesa accepted the request but did not return a valid checkout ID. Reconciliation is required."
    );

    uncertainError.paymentOutcomeUncertain = true;

    throw uncertainError;
  }

  return data;
}

async function querySTKPushStatus(checkoutRequestId) {
  if (
    typeof checkoutRequestId !== "string" ||
    !checkoutRequestId.trim()
  ) {
    throw new Error("A valid checkout request ID is required");
  }

  const accessToken = await getAccessToken();

  const businessShortCode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;

  if (!businessShortCode || !passkey) {
    throw new Error("M-Pesa STK configuration is incomplete");
  }

  const timestamp = generateTimestamp();

  const password = Buffer.from(
    `${businessShortCode}${passkey}${timestamp}`
  ).toString("base64");

  let response;

  try {
    response = await fetch(
      `${MPESA_BASE_URL}/mpesa/stkpushquery/v1/query`,
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
          CheckoutRequestID: checkoutRequestId.trim(),
        }),
      }
    );
  } catch (error) {
    console.error("M-Pesa STK Query request failed:", error.message);
    throw new Error("Could not connect to the M-Pesa STK Query service");
  }

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error("M-Pesa STK Query returned an unreadable response");
  }

  return {
    httpStatus: response.status,
    data,
  };
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
    if (error.paymentOutcomeUncertain) {
      console.error(
        "Payment requires reconciliation:",
        {
          paymentId: payment.id,
          requestId,
          reason: error.message,
        }
      );

      throw error;
    }

    if (error.paymentRejected) {
      await paymentRepository.markPaymentFailed(payment.id);
      throw error;
    }

    // OAuth or configuration failures happen before the STK request
    // is sent, so the payment can safely be marked as failed.
    if (
      error.message === "Could not connect to M-Pesa" ||
      error.message === "M-Pesa consumer credentials are not set" ||
      error.message === "Failed to get M-Pesa access token" ||
      error.message === "M-Pesa STK configuration is incomplete"
    ) {
      await paymentRepository.markPaymentFailed(payment.id);
      throw error;
    }

    // Unknown errors may occur after Safaricom has accepted the request.
    // Preserve the payment record until its outcome can be reconciled.
    console.error(
      "Payment initiation failed with an uncertain outcome:",
      {
        paymentId: payment.id,
        requestId,
        reason: error.message,
      }
    );

    throw error;
  }

}

async function initiateCashPayment({ requestId, payerId }) {
  const pool = require("../config/database");

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

  const amountCents = responsibility.repair_cost_cents;

  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error(
      "A valid repair cost has not been recorded for this request"
    );
  }

  if (responsibility.responsible_party === "tenant") {
    const tenantResult = await pool.query(
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
    const userResult = await pool.query(
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

  return paymentRepository.createPayment({
    maintenanceRequestId: requestId,
    payerId,
    amountCents,
    paymentMethod: "cash",
  });
}

async function handleCallback(callbackData) {
  const stkCallback = callbackData?.Body?.stkCallback;

  if (!stkCallback) {
    throw new Error("Invalid M-Pesa callback");
  }

  const checkoutRequestId = stkCallback.CheckoutRequestID;
  const resultCode = Number(stkCallback.ResultCode);

  if (
    typeof checkoutRequestId !== "string" ||
    !checkoutRequestId.trim() ||
    !Number.isInteger(resultCode)
  ) {
    throw new Error("Invalid M-Pesa callback details");
  }

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

  if (resultCode !== 0) {
    return paymentRepository.markPaymentFailed(payment.id);
  }

  const metadata = stkCallback.CallbackMetadata?.Item || [];

  const amountItem = metadata.find(
    (item) => item.Name === "Amount"
  );

  const receiptItem = metadata.find(
    (item) => item.Name === "MpesaReceiptNumber"
  );

  const callbackAmount = Number(amountItem?.Value);
  const expectedAmount = Number(payment.amount_cents) / 100;
  const transactionReference = receiptItem?.Value;

  if (
    amountItem?.Value === undefined ||
    !Number.isFinite(callbackAmount) ||
    callbackAmount <= 0
  ) {
    throw new Error(
      "M-Pesa callback did not contain a valid payment amount"
    );
  }

  if (callbackAmount !== expectedAmount) {
    throw new Error(
      "M-Pesa callback amount does not match the expected payment amount"
    );
  }

  if (
    typeof transactionReference !== "string" ||
    !transactionReference.trim()
  ) {
    throw new Error(
      "M-Pesa callback did not contain a transaction reference"
    );
  }

  return paymentRepository.markPaymentPaid({
    paymentId: payment.id,
    transactionReference: transactionReference.trim(),
  });
}

module.exports = {
  initiatePayment,
  initiateCashPayment,
  handleCallback,
  querySTKPushStatus,
};
