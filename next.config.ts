import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve = config.resolve || {}
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname, 'src'),
    }
    return config
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Skip ESLint during builds — the "circular structure" error in
  // next/core-web-vitals + next/typescript is a known Next.js 15.x
  // tooling conflict. TypeScript checking still runs separately.
  eslint: {
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
