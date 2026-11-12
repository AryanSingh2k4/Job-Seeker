import type { NextConfig } from "next";

// Static export per FINAL_EXECUTION_PLAN.md D17 — loaded by the Tauri 2 shell
// from frontend/out. Detail routes are query-based (/jobs?id=, /runs?id=)
// because runtime UUID segments cannot be statically generated.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
