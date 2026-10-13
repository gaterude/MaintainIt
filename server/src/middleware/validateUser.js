function validateUser(req, res, next) {
  const {
    name,
    email,
    phone,
    password,
    role,
  } = req.body;

  if (!name || !email || !phone || !password || !role) {
    return res.status(400).json({
      message: "Name, email, phone, password and role are required",
    });
  }

  const allowedRoles = ["tenant", "admin", "fundi"];

  if (!allowedRoles.includes(role)) {
    return res.status(400).json({
      message: "Invalid user role",
    });
  }

  next();
}

module.exports = validateUser;