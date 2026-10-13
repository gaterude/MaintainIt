const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const userRepository = require("../repositories/userRepository");

async function createUser({
  name,
  email,
  phone,
  password,
  role,
}) {
  const existingUser = await userRepository.findUserByEmail(email);

  if (existingUser) {
    throw new Error("A user with this email already exists");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  return userRepository.createUser({
    name,
    email,
    phone,
    passwordHash,
    role,
  });
}

async function loginUser({ email, password }) {
  const user = await userRepository.findUserByEmail(email);

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

  const token = jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN,
    }
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    },
  };
}

async function getFundis() {
  return userRepository.findFundis();
}

module.exports = {
  createUser,
  loginUser,
  getFundis,
};
