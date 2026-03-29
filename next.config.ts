import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // 移除原本報錯的 eslint 區塊，直接留空或不寫
};

export default nextConfig;