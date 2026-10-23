const VALID_ROLES = ["tenant", "admin", "fundi"];

function authorizeRole(...allowedRoles) {
if (
allowedRoles.length === 0 ||
allowedRoles.some((role) => !VALID_ROLES.includes(role))
) {
throw new Error("Invalid role authorization configuration.");
}

return (req, res, next) => {
if (!req.user) {
return res.status(401).json({
message: "Authentication required",
});
}


if (!allowedRoles.includes(req.user.role)) {
  return res.status(403).json({
    message: "You are not authorized to perform this action",
  });
}

return next();


};
}

module.exports = authorizeRole;
