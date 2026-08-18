import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execFileSync } from "node:child_process";

function resolveCommitSha() {
  const vercelCommit = String(process.env.VERCEL_GIT_COMMIT_SHA || "").trim();
  if (vercelCommit) return vercelCommit.slice(0, 7);
  try {
    return execFileSync("git", ["rev-parse", "--short=7", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "local";
  }
}

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_COMMIT_SHA__: JSON.stringify(resolveCommitSha()),
  },
  server: { host: "127.0.0.1", port: 5173 },
  build: { emptyOutDir: false },
});
