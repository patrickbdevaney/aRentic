/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    webpackMemoryOptimizations: true,
    webpackBuildWorker: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;