(async () => {
  const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
  const base = "http://localhost:3000";
  try {
    // Register
    let res = await fetch(base + "/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "testuser", email: "testuser@example.com", password: "TestPass123!" }),
    });
    const register = await res.json();
    console.log("REGISTER:", register);

    // Login
    res = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "testuser", password: "TestPass123!" }),
    });
    const login = await res.json();
    console.log("LOGIN:", login);

    const token = login.token;

    // Send message
    res = await fetch(base + "/api/chat/message", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sessionId: "test-session-1", message: "Hello, this is a test." }),
    });
    const chat = await res.json();
    console.log("CHAT RESPONSE:", chat);
  } catch (err) {
    console.error("ERROR:", err);
    process.exit(1);
  }
})();
