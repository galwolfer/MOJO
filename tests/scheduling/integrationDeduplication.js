/**
 * @file tests/scheduling/integrationDeduplication.js
 *
 * End-to-end smoke test for the scheduling deduplication fix.
 *
 * Prerequisites:
 *   - Backend server is running (npm run dev / node src/server.js)
 *   - A valid user account exists
 *
 * Usage:
 *   node tests/scheduling/integrationDeduplication.js \
 *     --base http://localhost:3000 \
 *     --email your@email.com \
 *     --password yourpassword
 *
 * What it does:
 *   1. Logs in and gets a JWT token.
 *   2. Fires N concurrent POST /api/tasks/reschedule-all requests (same user).
 *   3. Fetches all future TaskSchedule documents for the user via the schedule GET endpoint.
 *   4. Asserts that no (taskId, start, end, subtaskIndex) tuple appears more than once.
 *   5. Prints a PASS / FAIL summary.
 */

const ARGS = Object.fromEntries(
  process.argv.slice(2).reduce((acc, arg, i, arr) => {
    if (arg.startsWith("--")) acc.push([arg.slice(2), arr[i + 1]]);
    return acc;
  }, [])
);

const BASE   = ARGS.base     || "http://localhost:3000";
const EMAIL  = ARGS.email    || process.env.TEST_EMAIL;
const PASS   = ARGS.password || process.env.TEST_PASSWORD;
const CONCURRENCY = parseInt(ARGS.concurrency || "4", 10); // concurrent reschedule calls

if (!EMAIL || !PASS) {
  console.error("Usage: node integrationDeduplication.js --base <url> --email <email> --password <pw>");
  process.exit(1);
}

async function apiFetch(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function run() {
  // ── 1. Login ──────────────────────────────────────────────────────────────
  console.log(`[1/4] Logging in as ${EMAIL}…`);
  const { status: loginStatus, json: loginJson } = await apiFetch("/api/auth/login", {
    method: "POST",
    body: { email: EMAIL, password: PASS },
  });

  if (loginStatus !== 200 || !loginJson.token) {
    console.error("Login failed:", loginJson);
    process.exit(1);
  }
  const token = loginJson.token;
  console.log("      ✓ Logged in");

  // ── 2. Fire N concurrent reschedule-all requests ──────────────────────────
  console.log(`[2/4] Firing ${CONCURRENCY} concurrent POST /api/tasks/reschedule-all…`);
  const results = await Promise.allSettled(
    Array.from({ length: CONCURRENCY }, () =>
      apiFetch("/api/tasks/reschedule-all", { method: "POST", token })
    )
  );

  let successCount = 0;
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.status < 300) {
      successCount++;
      console.log(`      ✓ ${r.value.json.scheduledCount ?? "?"} sessions planned`);
    } else {
      const detail = r.status === "rejected" ? r.reason : r.value.json;
      console.warn("      ⚠ request failed:", detail);
    }
  }
  console.log(`      ${successCount}/${CONCURRENCY} requests succeeded`);

  // ── 3. Fetch the schedule ─────────────────────────────────────────────────
  console.log("[3/4] Fetching current schedule…");
  const { status: schedStatus, json: schedJson } = await apiFetch("/api/tasks/schedule", { token });

  if (schedStatus !== 200 || !Array.isArray(schedJson.schedule)) {
    // Fallback: try the sessions endpoint some apps expose
    const { status: s2, json: j2 } = await apiFetch("/api/tasks/sessions", { token });
    if (s2 !== 200 || !Array.isArray(j2.sessions ?? j2.schedule)) {
      console.error("Could not fetch schedule. Adjust the endpoint path for your API.", { schedStatus, schedJson });
      process.exit(1);
    }
    schedJson.schedule = j2.sessions ?? j2.schedule;
  }

  const sessions = schedJson.schedule;
  console.log(`      ✓ ${sessions.length} session(s) returned`);

  // ── 4. Check for duplicates ───────────────────────────────────────────────
  console.log("[4/4] Checking for duplicates…");
  const seen = new Map();
  const dupes = [];

  for (const s of sessions) {
    const start = s.start ? new Date(s.start).toISOString() : "?";
    const end   = s.end   ? new Date(s.end).toISOString()   : "?";
    const key   = `${s.taskId}|${start}|${end}|${s.subtaskIndex ?? ""}`;
    if (seen.has(key)) {
      dupes.push({ key, first: seen.get(key), second: s });
    } else {
      seen.set(key, s);
    }
  }

  if (dupes.length === 0) {
    console.log(`\n✅  PASS — ${sessions.length} sessions, 0 duplicates found.`);
    process.exit(0);
  } else {
    console.error(`\n❌  FAIL — ${dupes.length} duplicate(s) found:`);
    for (const d of dupes.slice(0, 5)) {
      console.error("   ", d.key);
    }
    if (dupes.length > 5) console.error(`    …and ${dupes.length - 5} more`);
    process.exit(1);
  }
}

run().catch((err) => { console.error("Unexpected error:", err); process.exit(1); });
