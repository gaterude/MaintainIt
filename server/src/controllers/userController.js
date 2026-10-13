const userService = require("../services/userService");

async function createUser(req, res) {
  try {
    const {
      name,
      email,
      phone,
      password,
      role,
    } = req.body;

    const user = await userService.createUser({
      name,
      email,
      phone,
      password,
      role,
    });

    res.status(201).json({
      message: "User created successfully",
      user,
    });
  } catch (error) {
    console.error("Create user error:", error);

    res.status(400).json({
      message: error.message,
    });
  }
}

async function loginUser(req, res) {
  try {
    const {
      email,
      password,
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const user = await userService.loginUser({
      email,
      password,
    });

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

    return res.status(200).json({
      fundis,
    });
  } catch (error) {
    console.error("Get fundis error:", error);

    return res.status(500).json({
      message: "Unable to retrieve registered fundis.",
    });
  }
}

module.exports = {
  createUser,
  loginUser,
  getFundis,
};