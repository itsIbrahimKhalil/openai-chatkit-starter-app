import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // === Your original webpack config (keep it) ===
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
    };
    return config;
  },

  // === ADD THIS: Allow iframe embedding ===
  async headers() {
    return [
      {
        // Apply to every route
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            // Replace with your WooCommerce domain
            value: "ALLOW-FROM https://stg.topnotchfurnishers.co.uk/",
          },
          {
            key: "Content-Security-Policy",
            // Modern browsers use CSP instead of X-Frame-Options
            value:
              "frame-ancestors 'self' https://stg.topnotchfurnishers.co.uk/ https://openai-chatkit-starter-bmy22w4jr.vercel.app;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
