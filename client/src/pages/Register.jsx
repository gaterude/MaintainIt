import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { styles } from "../styles";

function Register() {
const navigate = useNavigate();

const [name, setName] = useState("");
const [email, setEmail] = useState("");
const [phone, setPhone] = useState("");
const [password, setPassword] = useState("");
const [confirmPassword, setConfirmPassword] = useState("");

const [message, setMessage] = useState("");
const [messageType, setMessageType] = useState("");
const [fieldErrors, setFieldErrors] = useState({});
const [registering, setRegistering] = useState(false);

function clearFieldError(field) {
setFieldErrors((previous) => ({
...previous,
[field]: "",
}));
setMessage("");
setMessageType("");
}

async function handleRegister(event) {
event.preventDefault();


setMessage("");
setMessageType("");
setFieldErrors({});

const errors = {};

if (!name.trim()) {
  errors.name = "Please enter your full name.";
}

if (!email.trim()) {
  errors.email = "Please enter your email address.";
}

if (!phone.trim()) {
  errors.phone = "Please enter your phone number.";
}

if (password.length < 8) {
  errors.password = "Password must be at least 8 characters long.";
}

if (password !== confirmPassword) {
  errors.confirmPassword = "Passwords do not match.";
}

if (Object.keys(errors).length > 0) {
  setFieldErrors(errors);
  return;
}

setRegistering(true);

try {
  const response = await fetch("http://localhost:4000/api/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      password,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMessage =
      data.message || "Unable to create your account.";

    if (/email/i.test(errorMessage) && /already|registered|exists|invalid|required/i.test(errorMessage)) {
      setFieldErrors({ email: errorMessage });
    } else if (/phone|number/i.test(errorMessage) && /already|registered|exists|invalid|required/i.test(errorMessage)) {
      setFieldErrors({ phone: errorMessage });
    } else if (/password/i.test(errorMessage)) {
      setFieldErrors({ password: errorMessage });
    } else if (/name/i.test(errorMessage)) {
      setFieldErrors({ name: errorMessage });
    } else {
      setMessage(errorMessage);
      setMessageType("error");
    }

    return;
  }

  setMessage(
    "Your account has been created successfully. You can now log in."
  );
  setMessageType("success");

  setTimeout(() => {
    navigate("/login", { replace: true });
  }, 1500);
} catch (error) {
  console.error("Registration error:", error);
  setMessage("Unable to create your account. Please try again.");
  setMessageType("error");
} finally {
  setRegistering(false);
}


}

const fieldErrorStyle = {
color: "#c0392b",
fontSize: "12px",
marginTop: "4px",
marginBottom: "10px",
};

return ( <div style={styles.loginPage}> <div style={styles.loginCard}>
<h1 style={{ ...styles.brand, marginBottom: "8px" }}>
MaintainIt </h1>

```
    <p style={styles.muted}>
      Maintenance management made simple.
    </p>

    <h2 style={{ marginTop: "28px", marginBottom: "8px" }}>
      Create your account
    </h2>

    <p style={styles.muted}>
      Register as a tenant to manage your maintenance requests.
    </p>

    {message && (
      <div
        role={messageType === "error" ? "alert" : "status"}
        style={
          messageType === "success"
            ? styles.message
            : styles.error
        }
      >
        {message}
      </div>
    )}

    <form onSubmit={handleRegister} noValidate>
      <label htmlFor="name" style={styles.label}>
        Full name
      </label>
      <input
        id="name"
        type="text"
        autoComplete="name"
        placeholder="Enter your full name"
        style={styles.input}
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          clearFieldError("name");
        }}
        aria-invalid={Boolean(fieldErrors.name)}
        aria-describedby={fieldErrors.name ? "name-error" : undefined}
        required
      />
      {fieldErrors.name && (
        <p id="name-error" role="alert" style={fieldErrorStyle}>
          {fieldErrors.name}
        </p>
      )}

      <label htmlFor="email" style={styles.label}>
        Email address
      </label>
      <input
        id="email"
        type="email"
        autoComplete="email"
        placeholder="Enter your email"
        style={styles.input}
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          clearFieldError("email");
        }}
        aria-invalid={Boolean(fieldErrors.email)}
        aria-describedby={fieldErrors.email ? "email-error" : undefined}
        required
      />
      {fieldErrors.email && (
        <p id="email-error" role="alert" style={fieldErrorStyle}>
          {fieldErrors.email}
        </p>
      )}

      <label htmlFor="phone" style={styles.label}>
        Phone number
      </label>
      <input
        id="phone"
        type="tel"
        autoComplete="tel"
        placeholder="e.g. 0712345678 or +254712345678"
        style={styles.input}
        value={phone}
        onChange={(event) => {
          setPhone(event.target.value);
          clearFieldError("phone");
        }}
        aria-invalid={Boolean(fieldErrors.phone)}
        aria-describedby={fieldErrors.phone ? "phone-error" : undefined}
        required
      />
      {fieldErrors.phone && (
        <p id="phone-error" role="alert" style={fieldErrorStyle}>
          {fieldErrors.phone}
        </p>
      )}

      <label htmlFor="password" style={styles.label}>
        Password
      </label>
      <input
        id="password"
        type="password"
        autoComplete="new-password"
        placeholder="At least 8 characters"
        style={styles.input}
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
          clearFieldError("password");
          clearFieldError("confirmPassword");
        }}
        aria-invalid={Boolean(fieldErrors.password)}
        aria-describedby={fieldErrors.password ? "password-error" : undefined}
        minLength={8}
        required
      />
      {fieldErrors.password && (
        <p id="password-error" role="alert" style={fieldErrorStyle}>
          {fieldErrors.password}
        </p>
      )}

      <label htmlFor="confirmPassword" style={styles.label}>
        Confirm password
      </label>
      <input
        id="confirmPassword"
        type="password"
        autoComplete="new-password"
        placeholder="Enter your password again"
        style={styles.input}
        value={confirmPassword}
        onChange={(event) => {
          setConfirmPassword(event.target.value);
          clearFieldError("confirmPassword");
        }}
        aria-invalid={Boolean(fieldErrors.confirmPassword)}
        aria-describedby={
          fieldErrors.confirmPassword
            ? "confirmPassword-error"
            : undefined
        }
        minLength={8}
        required
      />
      {fieldErrors.confirmPassword && (
        <p
          id="confirmPassword-error"
          role="alert"
          style={fieldErrorStyle}
        >
          {fieldErrors.confirmPassword}
        </p>
      )}

      <button
        type="submit"
        style={{
          ...styles.button,
          width: "100%",
          opacity: registering ? 0.7 : 1,
          marginTop: "4px",
        }}
        disabled={registering}
      >
        {registering ? "Creating account..." : "Create Account"}
      </button>
    </form>

    <p
      style={{
        textAlign: "center",
        marginTop: "22px",
        marginBottom: 0,
        fontSize: "14px",
        color: "#6b7787",
      }}
    >
      Already have an account?{" "}
      <Link
        to="/login"
        style={{
          color: "#28745b",
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        Sign in
      </Link>
    </p>

    <p
      style={{
        textAlign: "center",
        marginTop: "18px",
        marginBottom: 0,
        fontSize: "12px",
        color: "#6b7787",
      }}
    >
      Fundis and administrators must use accounts created for them.
    </p>
  </div>
</div>


);
}

export default Register;
