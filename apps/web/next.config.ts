import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The shared package ships TypeScript source.
  transpilePackages: ['@gravn/shared'],
};

export default nextConfig;
