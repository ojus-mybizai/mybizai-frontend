import type { NextConfig } from "next";
import path from "node:path";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "standalone",

  // Pin the workspace root to this folder. Without it, Next infers the repo
  // root (which carries its own package.json + react/react-dom for the
  // docx/pptx tooling) as the root and resolves a second, duplicate module
  // graph — leaving components bound to stale store instances in dev.
  turbopack: {
    root: path.resolve(__dirname),
  },

  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // AWS S3 buckets (production image storage)
      { protocol: "https", hostname: "*.amazonaws.com" },
      { protocol: "https", hostname: "*.s3.amazonaws.com" },
      // Local dev API
      { protocol: "http", hostname: "127.0.0.1", port: "8000" },
      { protocol: "http", hostname: "localhost", port: "8000" },
    ],
  },

  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
      "xlsx",
    ],
  },

  async redirects() {
    return [
      // Legacy /conversations route renamed to /inbox (kept for bookmarks & deep links)
      { source: "/conversations", destination: "/inbox", permanent: false },
      { source: "/conversations/:path*", destination: "/inbox/:path*", permanent: false },
    ];
  },

  async headers() {
    // Only send long-lived immutable caching in production. In dev, immutable
    // headers make the browser pin stale Turbopack chunks so a normal reload
    // never picks up recompiled code.
    if (!isProd) return [];
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/fonts/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  
};

export default nextConfig;
