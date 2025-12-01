import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint:{
    ignoreDuringBuilds:true,
  },
   webpack: (config) => {
    // Ignore your user folder to prevent EPERM errors
    config.watchOptions = {
      ignored: ['C:/Users/Kashif Afridi/**'],
    };
    return config;
  },
};

export default nextConfig;
