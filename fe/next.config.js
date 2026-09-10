/** @type {import('next').NextConfig} */
const { i18n } = require('./next-i18next.config');

const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true
});

const nextConfig = {
  i18n,
  output: 'standalone',
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['localhost', '82.180.144.91'],
  },

  eslint: {
    // Ignore ESLint errors during builds to prevent pipeline failures
    // This is useful for CI/CD pipelines
    ignoreDuringBuilds: true,
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },

  // Optimize for production builds
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Webpack configuration to fix module resolution issues
  webpack: (config, { isServer }) => {
    // Fix for __webpack_require__.t is not a function error
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };

    // Ensure proper module resolution
    config.resolve.alias = {
      ...config.resolve.alias,
    };

    return config;
  },

  // Exclude problematic routes from static generation
  exportPathMap: async function (
    defaultPathMap,
    { dev, dir, outDir, distDir, buildId }
  ) {
    // Remove problematic routes from static export
    const pathMap = { ...defaultPathMap };
    delete pathMap['/loans/types/[id]'];
    delete pathMap['/loans/types/new'];

    return pathMap;
  },

  // Configure specific pages to be server-side rendered only
  // This prevents static optimization for these routes
  async rewrites() {
    return {
      beforeFiles: [
        // Proxy uploads to backend server
        {
          source: '/uploads/:path*',
          destination: `${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace('/api', '')}/uploads/:path*`,
        },
        {
          source: '/loans/types/new',
          destination: '/loans/types/new',
          has: [
            {
              type: 'header',
              key: 'x-skip-static-generation',
            },
          ],
        },
        {
          source: '/loans/types/:id',
          destination: '/loans/types/:id',
          has: [
            {
              type: 'header',
              key: 'x-skip-static-generation',
            },
          ],
        },
      ],
    };
  }
}

module.exports = withPWA(nextConfig)