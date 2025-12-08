import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // If you are using images from remote URLs (e.g., CDN / API)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },

  // ✅ Ignore type and lint errors only during production build
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
