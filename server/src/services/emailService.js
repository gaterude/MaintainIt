const { Resend } = require("resend");

let resendClient;

function getResendClient() {
if (!process.env.RESEND_API_KEY) {
throw new Error("Email service is not configured.");
}

if (!resendClient) {
resendClient = new Resend(process.env.RESEND_API_KEY);
}

return resendClient;
}

async function sendEmail({ to, subject, html }) {
if (!to || !subject || !html) {
throw new Error("Recipient, subject, and email content are required.");
}

const from = process.env.EMAIL_FROM;

if (!from) {
throw new Error("EMAIL_FROM is not configured.");
}

const resend = getResendClient();

const { data, error } = await resend.emails.send({
from,
to: [to],
subject,
html,
});

if (error) {
throw new Error(error.message || "Email delivery failed.");
}

return data;
}

async function sendLoginNotification(user) {
return sendEmail({
to: user.email,
subject: "Successful login to MaintainIt",
html: `       <div style="font-family: Arial, sans-serif; line-height: 1.6;">         <h2>Login successful</h2>         <p>Hello ${escapeHtml(user.name)},</p>         <p>Your MaintainIt account was accessed successfully.</p>         <p>If this wasn't you, please contact your system administrator.</p>         <p>MaintainIt Support</p>       </div>
    `,
});
}

async function sendRoomAssignmentNotification(user, room) {
return sendEmail({
to: user.email,
subject: "Your room assignment has been confirmed",
html: `       <div style="font-family: Arial, sans-serif; line-height: 1.6;">         <h2>Room assignment confirmed</h2>         <p>Hello ${escapeHtml(user.name)},</p>         <p>Your room assignment in MaintainIt was successful.</p>         <p><strong>Room:</strong> ${escapeHtml(String(room.room_number))}</p>         <p>You can log in to MaintainIt to manage your maintenance requests.</p>         <p>MaintainIt Support</p>       </div>
    `,
});
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}




module.exports = {
sendEmail,
sendLoginNotification,
sendRoomAssignmentNotification,
};

