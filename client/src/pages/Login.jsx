import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { styles } from "../styles";

function Login() {
const navigate = useNavigate();

const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [message, setMessage] = useState("");
const [loggingIn, setLoggingIn] = useState(false);

async function handleLogin(event) {
event.preventDefault();


setMessage("");
setLoggingIn(true);

try {
  const response = await fetch(
    "http://localhost:4000/api/users/login",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email.trim(),
        password,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Login failed.");
  }

  const token = data.user?.token;
  const loggedInUser = data.user?.user;

  if (!token || !loggedInUser) {
    throw new Error("Invalid login response from the server.");
  }

  if (!["tenant", "admin", "fundi"].includes(loggedInUser.role)) {
    throw new Error("Your account has an unrecognized role.");
  }

  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(loggedInUser));

  if (loggedInUser.role === "tenant") {
    navigate("/tenant/dashboard", { replace: true });
  } else if (loggedInUser.role === "admin") {
    navigate("/admin/dashboard", { replace: true });
  } else {
    navigate("/fundi/dashboard", { replace: true });
  }
} catch (error) {
  console.error("Login error:", error);
  setMessage(error.message || "Unable to log in. Please try again.");
} finally {
  setLoggingIn(false);
}


}

return ( <div style={styles.loginPage}> <div style={styles.loginCard}>
<h1 style={{ ...styles.brand, marginBottom: "8px" }}>
MaintainIt </h1>


    <p style={styles.muted}>
      Maintenance management made simple.
    </p>

    <h2 style={{ marginTop: "28px" }}>Welcome back</h2>

    <p style={styles.muted}>
      Sign in to manage your maintenance requests.
    </p>

    {message && (
      <div role="alert" style={styles.error}>
        {message}
      </div>
    )}

    <form onSubmit={handleLogin}>
      <label htmlFor="email" style={styles.label}>
        Email address
      </label>

      <input
        id="email"
        type="email"
        autoComplete="username"
        placeholder="Enter your email"
        style={styles.input}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />

      <label htmlFor="password" style={styles.label}>
        Password
      </label>

      <input
        id="password"
        type="password"
        autoComplete="current-password"
        placeholder="Enter your password"
        style={styles.input}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />

      <button
        type="submit"
        style={{
          ...styles.button,
          width: "100%",
          opacity: loggingIn ? 0.7 : 1,
        }}
        disabled={loggingIn}
      >
        {loggingIn ? "Signing in..." : "Login"}
      </button>
    </form>
  </div>
</div>


);
}

export default Login;
