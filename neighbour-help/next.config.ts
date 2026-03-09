import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a standalone Node.js server — much smaller Docker image.
  // Copies only the necessary files (no node_modules bloat).
  output: "standalone",

  async rewrites() {
    // All client-side fetch("/api/proxy/...") calls are transparently forwarded
    // to the ASP.NET backend. The browser never needs to know the backend URL.
    // API_URL is a server-side-only env var (no NEXT_PUBLIC_ prefix), so it can
    // be injected at container start time via docker-compose / K8s secrets.
    const backendUrl = process.env.API_URL ?? "http://localhost:5000";
    return [
      {
        source: "/api/proxy/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
