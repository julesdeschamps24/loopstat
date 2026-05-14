import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Force the canonical host 127.0.0.1. The Spotify OAuth redirect_uri is
  // pinned to 127.0.0.1, so the session cookie lives on that host; any request
  // that arrives on localhost can't see it and bounces the user to /login.
  // A config-level redirect runs before routing and any client JS.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "localhost" }],
        destination: "http://127.0.0.1:3000/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
