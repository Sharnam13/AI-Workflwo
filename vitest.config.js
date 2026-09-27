import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Tests never call the real Gemini API.
    env: { GEMINI_API_KEY: "" },
    hookTimeout: 120_000, // first run downloads a MongoDB binary
  },
});
