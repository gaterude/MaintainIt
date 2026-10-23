const jwt = require("jsonwebtoken");

const ALLOWED_ROLES = ["tenant", "admin", "fundi"];

function authenticateToken(req, res, next) {
const authHeader = req.headers.authorization;

if (
typeof authHeader !== "string" ||
!authHeader.startsWith("Bearer ")
) {
return res.status(401).json({
message: "Authentication required",
});
}

const token = authHeader.slice(7).trim();

if (!token) {
return res.status(401).json({
message: "Authentication required",
});
}

if (!process.env.JWT_SECRET) {
console.error("JWT_SECRET is not configured.");


return res.status(500).json({
  message: "Authentication service is not configured",
});


}

try {
const decoded = jwt.verify(token, process.env.JWT_SECRET);


if (
  !decoded ||
  typeof decoded !== "object" ||
  (typeof decoded.id !== "string" &&
    typeof decoded.id !== "number") ||
  !ALLOWED_ROLES.includes(decoded.role)
) {
  return res.status(401).json({
    message: "Invalid authentication token",
  });
}

req.user = {
  id: decoded.id,
  role: decoded.role,
};

return next();


} catch (error) {
return res.status(401).json({
message: "Invalid or expired token",
});
}
}

module.exports = authenticateToken;
