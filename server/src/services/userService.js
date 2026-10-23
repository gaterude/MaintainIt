const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const userRepository = require("../repositories/userRepository");
const emailService = require("./emailService");

async function createUser({
  name,
  email,
  phone,
  password,
  role,
}) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = phone.trim();

  const existingUser =
    await userRepository.findUserByEmail(normalizedEmail);

  if (existingUser) {
    throw new Error(
      "This email address is already registered. Please log in or use another email."
    );
  }

  const existingPhone =
    await userRepository.findUserByPhone(normalizedPhone);

  if (existingPhone) {
    throw new Error(
      "This phone number is already registered. Please use another number."
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    return await userRepository.createUser({
      name: name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      passwordHash,
      role,
    });
  } catch (error) {
    if (error.code === "23505") {
      if (error.constraint?.toLowerCase().includes("email")) {
        throw new Error(
          "This email address is already registered. Please log in or use another email."
        );
      }

      if (error.constraint?.toLowerCase().includes("phone")) {
        throw new Error(
          "This phone number is already registered. Please use another number."
        );
      }
    }

    throw error;
  }
}

async function loginUser({ email, password }) {
  if (
    typeof email !== "string" ||
    !email.trim() ||
    typeof password !== "string" ||
    !password
  ) {
    throw new Error("Email and password are required");
  }

  if (!process.env.JWT_SECRET) {
    throw new Error("Authentication service is not configured");
  }

  const normalizedEmail = email.trim().toLowerCase();

  const user =
    await userRepository.findUserByEmail(normalizedEmail);

  if (!user) {
    throw new Error("Invalid email or password");
  }

  const passwordMatches = await bcrypt.compare(
    password,
    user.password_hash
  );

  if (!passwordMatches) {
    throw new Error("Invalid email or password");
  }

  const tokenOptions = {
    expiresIn: process.env.JWT_EXPIRES_IN || "1h",
  };

  const token = jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    tokenOptions
  );

  const loggedInUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
  };

  emailService.sendLoginNotification(loggedInUser).catch((error) => {
    console.error("Login notification email failed:", error.message);
  });

  return {
    token,
    user: loggedInUser,
  };
}

async function getFundis() {
  return userRepository.findFundis();
}

module.exports = {
  createUser,
  loginUser,
  getFundis,
}
