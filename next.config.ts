import type { NextConfig } from "next";
import path from "path";


const nextConfig: NextConfig = {
  /* config options here */
  eslint:{
    ignoreDuringBuilds:true,
  },
    webpack: (config) => {
    config.watchOptions = {
      ignored: [path.resolve(process.cwd(), 'C:/Users/Kashif Afridi/**')],
    };
    return config;
  },
};

export default nextConfig;
