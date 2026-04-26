import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // onnxruntime-node usa addons nativos (.node) — no debe ser procesado por webpack
  serverExternalPackages: ["onnxruntime-node"],
};

export default nextConfig;
