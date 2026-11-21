import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle (.next/standalone) for a small production Docker image.
  output: "standalone",
  poweredByHeader: false,
};

export default nextConfig;
