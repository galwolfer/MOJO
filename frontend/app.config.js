const path = require("path");

// Load project .env automatically at build time so contributors don't need to
// export env vars manually in their shell. If dotenv isn't installed, fall
// back to existing process.env values.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dotenv = require("dotenv");
  const envPath = path.resolve(__dirname, "..", ".env");
  dotenv.config({ path: envPath });
} catch (e) {
  // ignore if dotenv not available
}

module.exports = ({ config }) => ({
  ...config,
  extra: {
    EXPO_PUBLIC_API_BASE: process.env.EXPO_PUBLIC_API_BASE || "http://localhost:3000/api",
  },
});

