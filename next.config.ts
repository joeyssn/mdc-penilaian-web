import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev server: addresses (other than localhost) you open the site from. Without this, Next.js 16
  // blocks them and the hot-reload WebSocket fails. Add your computer's IPv4 from `ipconfig`.
  allowedDevOrigins: ['192.168.56.1', '192.168.*.*', '10.*.*.*'],
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
