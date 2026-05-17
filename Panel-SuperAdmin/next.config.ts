import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Optimized Docker image output
  output: 'standalone',
}

export default nextConfig
