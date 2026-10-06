import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  devIndicators: false,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  turbopack: { root: process.cwd() },

  async rewrites() {
    if (process.env.NEXT_PUBLIC_CONTENT_MODE === "published") {
      return process.env.NOVEL_API_URL
        ? [{ source: "/reader3/:path*", destination: `${process.env.NOVEL_API_URL}/reader3/:path*` }]
        : [];
    }
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8000/api/:path*",
      },
      {
        source: "/uploads/:path*",
        destination: "http://127.0.0.1:8000/uploads/:path*",
      },
      {
        source: "/reader3/:path*",
        destination: `${process.env.NOVEL_API_URL || "http://localhost:8085"}/reader3/:path*`,
      },
    ];
  },

  experimental: {
    optimizePackageImports: [
      "framer-motion",
      "lucide-react",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
    ],
  },

  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "http", hostname: "wfqqreader-1252317822.image.myqcloud.com" },
    ],
  },
};

export default nextConfig;
