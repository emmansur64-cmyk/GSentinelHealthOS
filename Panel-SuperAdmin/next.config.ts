import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Panel-SuperAdmin is a standalone admin panel — no public asset sharing with other services
  poweredByHeader: false,
  // Strict mode for catching React issues early
  reactStrictMode: true,
}

export default nextConfig
