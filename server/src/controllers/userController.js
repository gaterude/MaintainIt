const userService = require("../services/userService");

// Shared checks for both sign-up routes.
function readAccountFields(body) {
  const { name, email, phone, password } = body || {};

  if (
    typeof name !== "string" || !name.trim() ||
    typeof email !== "string" || !email.trim() ||
    typeof phone !== "string" || !phone.trim() ||
    typeof password !== "string"
  ) {
    return { error: "Name, email, phone number and password are required." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters long." };
  }

  return { fields: { name, email, phone, password } };
}

// Public sign-up (POST /users). The role is NEVER read from the request:
// anyone can call this route, so it can only create tenants.
async function createUser(req, res) {
  try {
    const { fields, error } = readAccountFields(req.body);

    if (error) return res.status(400).json({ message: error });

    const user = await userService.createUser({ ...fields, role: "tenant" });

    res.status(201).json({ message: "User created successfully", user });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(400).json({ message: error.message });
  }
}

// Staff sign-up (POST /users/staff). The route already requires a logged-in admin.
// The role comes from the request but is limited to admin or fundi.
async function createStaffUser(req, res) {
  try {
    const { fields, error } = readAccountFields(req.body);

    if (error) return res.status(400).json({ message: error });

    const role = req.body.role;

    if (!["admin", "fundi"].includes(role)) {
      return res.status(400).json({ message: "Role must be admin or fundi." });
    }

    const user = await userService.createUser({ ...fields, role });

    res.status(201).json({ message: "Staff account created successfully", user });
  } catch (error) {
    console.error("Create staff user error:", error);
    res.status(400).json({ message: error.message });
  }
}

async function loginUser(req, res) {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const user = await userService.loginUser({ email, password });

    res.status(200).json({
      message: "Login successful",
      user,
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(401).json({
      message: error.message,
    });
  }
}

async function getFundis(req, res) {
  try {
    const fundis = await userService.getFundis();

    return res.status(200).json({ fundis });
  } catch (error) {
    console.error("Get fundis error:", error);

    return res.status(500).json({
      message: "Unable to retrieve registered fundis.",
    });
  }
}

module.exports = {
  createUser,
  createStaffUser,
  loginUser,
  getFundis,
};