/** @type {import('next').NextConfig} */

// Anam streams media over WebRTC and loads the SDK from this origin; MediaPipe loads its
// WASM from jsDelivr and the face model from Google storage. Keep the lists tight.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: mediastream:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.anam.ai wss://*.anam.ai https://cdn.jsdelivr.net https://storage.googleapis.com https://*.livekit.cloud wss://*.livekit.cloud https: wss:",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Microphone and camera are needed by this origin only.
  { key: "Permissions-Policy", value: "microphone=(self), camera=(self), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};
export default nextConfig;
