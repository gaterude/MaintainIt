function validateUser(...allowedRoles) {
return function (req, res, next) {
const { name, email, phone, password, role } = req.body;

if (!name || !email || !phone || !password) {
  return res.status(400).json({
    message: "Name, email, phone and password are required",
  });
}

if (typeof name !== "string" || !name.trim()) {
  return res.status(400).json({
    message: "A valid name is required",
  });
}

if (typeof email !== "string") {
  return res.status(400).json({
    message: "A valid email is required",
  });
}

const normalizedEmail = email.trim().toLowerCase();

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (!emailPattern.test(normalizedEmail)) {
  return res.status(400).json({
    message: "A valid email address is required",
  });
}

const normalizedPhone =
  typeof phone === "string" ? phone.trim() : "";

const phonePattern = /^(?:\+254|0)(?:7\d{8}|1\d{8})$/;

if (!phonePattern.test(normalizedPhone)) {
  return res.status(400).json({
    message: "Enter a valid Kenyan phone number",
  });
}

if (typeof password !== "string" || password.length < 8) {
  return res.status(400).json({
    message: "Password must be at least 8 characters long",
  });
}

if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
  return res.status(500).json({
    message: "User registration is not configured correctly",
  });
}

if (
  role !== undefined &&
  role !== null &&
  role !== "" &&
  (typeof role !== "string" || !allowedRoles.includes(role))
) {
  return res.status(403).json({
    message: "This endpoint does not allow the requested role",
  });
}

if (allowedRoles.length > 1 && !role) {
  return res.status(400).json({
    message: "Role is required for staff registration",
  });
}

req.body.name = name.trim();
req.body.email = normalizedEmail;
req.body.phone = normalizedPhone;
req.body.role = role || allowedRoles[0];

next();


};
}

module.exports = validateUser;
