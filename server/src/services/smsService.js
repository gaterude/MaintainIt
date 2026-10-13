const https = require("https");

async function sendSms({ phoneNumber, message }) {
  const username = process.env.AT_USERNAME;
  const apiKey = process.env.AT_API_KEY;

  if (!username || !apiKey) {
    throw new Error(
      "Africa's Talking SMS configuration is incomplete"
    );
  }

  const body = new URLSearchParams({
    username,
    to: phoneNumber,
    message,
  }).toString();

  const options = {
    hostname: "api.sandbox.africastalking.com",
    path: "/version1/messaging",
    method: "POST",
    headers: {
      apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(body),
      Accept: "application/json",
    },
  };

  return new Promise((resolve, reject) => {
    const request = https.request(options, (response) => {
      let responseBody = "";

      response.setEncoding("utf8");

      response.on("data", (chunk) => {
        responseBody += chunk;
      });

      response.on("end", () => {
        let data;

        try {
          data = JSON.parse(responseBody);
        } catch {
          console.error(
            "Africa's Talking returned a non-JSON response:",
            response.statusCode
          );

          return reject(
            new Error("Invalid response from Africa's Talking")
          );
        }

        if (
          response.statusCode < 200 ||
          response.statusCode >= 300
        ) {
          console.error(
            "SMS sending failed:",
            response.statusCode,
            data
          );

          return reject(
            new Error("Failed to send SMS")
          );
        }

       console.log(
  "Africa's Talking API response:",
  JSON.stringify(data, null, 2)
);
        resolve(data);
      });
    });

    request.on("error", (error) => {
      console.error("SMS connection failed:", error.message);
      reject(error);
    });

    request.write(body);
    request.end();
  });
}

module.exports = {
  sendSms,
};