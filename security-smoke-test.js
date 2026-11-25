// Security smoke test for MaintainIt. Run it against YOUR OWN local server only.
//
//   set API_URL=http://localhost:4000
//   set ADMIN_EMAIL=...      set ADMIN_PASSWORD=...
//   set TENANT_EMAIL=...     set TENANT_PASSWORD=...
//   optional: set TENANT2_EMAIL=... TENANT2_PASSWORD=...   (second tenant, for the cross-tenant test)
//   node security-smoke-test.js
//   node security-smoke-test.js --bruteforce     (also tests the login limiter; locks your IP for 15 min)
//
// Use test accounts. Passwords come from the environment, never from this file.

const API = (process.env.API_URL || "http://localhost:4000").replace(/\/$/, "");
const results = [];

function record(name, pass, detail = "") {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`);
}

async function call(method, path, { token, body } = {}) {
  const response = await fetch(API + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try { data = await response.json(); } catch { /* not JSON */ }
  return { status: response.status, data };
}

async function login(email, password) {
  if (!email || !password) return null;
  const { status, data } = await call("POST", "/users/login", { body: { email, password } });
  if (status !== 200) return null;
  return data?.user?.token || data?.token || null;
}

const b64 = (value) => Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");

function decodePayload(token) {
  return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
}

const denied = (status) => status === 401 || status === 403;

async function main() {
  console.log(`Testing ${API}\n`);

  const adminToken = await login(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
  const tenantToken = await login(process.env.TENANT_EMAIL, process.env.TENANT_PASSWORD);

  record("Admin test account can log in", Boolean(adminToken), adminToken ? "" : "set ADMIN_EMAIL / ADMIN_PASSWORD");
  record("Tenant test account can log in", Boolean(tenantToken), tenantToken ? "" : "set TENANT_EMAIL / TENANT_PASSWORD");

  // 1. Protected route without a token
  let r = await call("GET", "/users/fundis");
  record("Admin route without a token is rejected", denied(r.status), `status ${r.status}`);

  // 2. Garbage token
  r = await call("GET", "/users/fundis", { token: "not.a.jwt" });
  record("Garbage token is rejected", denied(r.status), `status ${r.status}`);

  if (tenantToken) {
    // 3. Tenant token on an admin route
    r = await call("GET", "/users/fundis", { token: tenantToken });
    record("Tenant token cannot use an admin route", r.status === 403 || r.status === 401, `status ${r.status}`);

    // 4. Tampered payload (role changed to admin) with the original signature
    const [header, , signature] = tenantToken.split(".");
    const payload = decodePayload(tenantToken);
    const tampered = `${header}.${b64({ ...payload, role: "admin" })}.${signature}`;
    r = await call("GET", "/users/fundis", { token: tampered });
    record("Token with a changed role (bad signature) is rejected", denied(r.status), `status ${r.status}`);

    // 5. alg:none forged token
    const none = `${b64({ alg: "none", typ: "JWT" })}.${b64({ ...payload, role: "admin" })}.`;
    r = await call("GET", "/users/fundis", { token: none });
    record("alg:none forged token is rejected", denied(r.status), `status ${r.status}`);

    // 6. Expired token (exp in the past, original signature)
    const expired = `${header}.${b64({ ...payload, exp: Math.floor(Date.now() / 1000) - 3600 })}.${signature}`;
    r = await call("GET", "/maintenance-requests/my-requests", { token: expired });
    record("Expired / altered token is rejected", denied(r.status), `status ${r.status}`);

    // 7. Tenant cannot create staff
    r = await call("POST", "/users/staff", {
      token: tenantToken,
      body: { role: "admin", name: "Smoke Test", email: `smoke${Date.now()}@example.com`, phone: "0700000099", password: "password123" },
    });
    record("Tenant cannot create staff accounts", denied(r.status), `status ${r.status}`);
  }

  // 8. Public sign-up must not create an admin
  const email = `smoke${Date.now()}@example.com`;
  r = await call("POST", "/users", {
    body: { name: "Smoke Test", email, phone: `07${String(Date.now()).slice(-8)}`, password: "password123", role: "admin" },
  });
  const createdRole = r.data?.user?.role;
  record(
    "Public sign-up with role=admin does not create an admin",
    r.status >= 400 || createdRole === "tenant",
    `status ${r.status}, role ${createdRole || "none"}  (delete the test user ${email} afterwards if it was created)`
  );

  // 9. Cross-tenant access (needs a second tenant and a request ID from the first)
  const tenant2Token = await login(process.env.TENANT2_EMAIL, process.env.TENANT2_PASSWORD);
  if (tenantToken && tenant2Token) {
    const mine = await call("GET", "/maintenance-requests/my-requests", { token: tenantToken });
    const first = mine.data?.requests?.[0];
    if (first?.id) {
      const photos = await call("GET", `/maintenance-photos/${first.id}`, { token: tenant2Token });
      record("Second tenant cannot read the first tenant's request photos", denied(photos.status) || photos.status === 404, `status ${photos.status}`);
    } else {
      console.log("SKIP  Cross-tenant test: the first tenant has no requests yet");
    }
  } else {
    console.log("SKIP  Cross-tenant test: set TENANT2_EMAIL / TENANT2_PASSWORD to run it");
  }

  // 10. Brute force (optional)
  if (process.argv.includes("--bruteforce")) {
    let limited = false;
    for (let i = 0; i < 15; i += 1) {
      const attempt = await call("POST", "/users/login", { body: { email: "nobody@example.com", password: "wrong-password" } });
      if (attempt.status === 429) { limited = true; break; }
    }
    record("Login is rate limited after repeated failures", limited);
  } else {
    console.log("SKIP  Brute-force test: run with --bruteforce (locks your IP for 15 minutes)");
  }

  const failed = results.filter((item) => !item.pass);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed.`);
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((error) => {
  console.error("Test run failed:", error.message);
  process.exitCode = 1;
});