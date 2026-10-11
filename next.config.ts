import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The holdings page was renamed from "MyStoks"; keep old links working.
  async redirects() {
    return [{ source: "/mystoks", destination: "/mystocks", permanent: true }];
  },
};

export default nextConfig;
