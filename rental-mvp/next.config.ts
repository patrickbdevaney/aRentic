/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  experimental: {
    webpackBuildWorker: true
  },
  productionBrowserSourceMaps: false
};

module.exports = nextConfig;