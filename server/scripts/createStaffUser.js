// Creates a fundi or an admin from the command line. The password is typed at a
// hidden prompt, so it never appears in your shell history.
//
// Usage (from the project root):
//   node server/scripts/createStaffUser.js admin "Full Name" email@example.com 0712345678
//   node server/scripts/createStaffUser.js fundi "Full Name" email@example.com 0712345678
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const readline = require("readline");
const userService = require("../src/services/userService");
const pool = require("../src/config/database");

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl._writeToOutput = (text) => {
      // Show the question, but print nothing while the password is typed.
      if (text.includes(question)) rl.output.write(text);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function main() {
  const [role, name, email, phone] = process.argv.slice(2);

  if (!["admin", "fundi"].includes(role) || !name || !email || !phone) {
    console.error('Usage: node server/scripts/createStaffUser.js <admin|fundi> "Full Name" <email> <phone>');
    process.exitCode = 1;
    return;
  }

  const password = await askHidden("Password (min 8 characters): ");

  if (password.length < 8) {
    console.error("Password must be at least 8 characters long.");
    process.exitCode = 1;
    return;
  }

  const user = await userService.createUser({ name, email, phone, password, role });
  console.log(`Created ${user.role}: ${user.name} (${user.email})`);
}

main()
  .catch((error) => {
    console.error("Could not create the user:", error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());