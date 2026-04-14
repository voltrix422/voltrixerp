import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "kpvyxjjiicgpsjkxwbmy.supabase.co",
      },
    ],
  },
};

export default nextConfig;
