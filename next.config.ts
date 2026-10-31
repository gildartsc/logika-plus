import type { NextConfig } from "next";

// Sent with every response.
export const SECURITY_HEADERS = [
  // The site may not be embedded in other pages (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // Browsers must not guess file types (uploaded files are served by Supabase,
  // but our own responses follow the same rule).
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // No page needs these. Choosing a photo with the phone camera goes through
  // the file picker and is not affected.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // Dev only: lets a phone on the home network open `npm run dev` by the
  // computer's address (e.g. http://192.168.1.117:3000). Without it the dev
  // server rejects script requests from that origin and the page never
  // becomes interactive. Production builds are not affected.
  allowedDevOrigins: ["192.168.*.*"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
