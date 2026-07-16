import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'mdc.sch.id',
        port: '',
        pathname: '/**', 
      },
      // Here is the new rule that allows Wikipedia images
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
        port: '',
        pathname: '/**', 
      },
    ],
  },
};

export default nextConfig;
