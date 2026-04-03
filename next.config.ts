import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['dexie', 'dexie-react-hooks'],
  serverExternalPackages: ['@prisma/client', 'bcryptjs', 'xlsx', 'sharp'],
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
