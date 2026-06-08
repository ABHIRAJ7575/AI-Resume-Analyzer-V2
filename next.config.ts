import type { NextConfig } from "next";

// ─── Content Security Policy ──────────────────────────────────────────────────
//
// Applied via next.config.ts headers() — the static (no-nonce) approach
// documented in node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md.
//
// We use 'unsafe-inline' for scripts and styles because:
//  - Next.js App Router injects inline scripts for hydration.
//  - Tailwind CSS generates inline styles at runtime in development.
//  - Nonce-based CSP requires all pages to be dynamically rendered, which
//    conflicts with static generation and ISR (see CSP guide §Static vs Dynamic).
//
// In development, 'unsafe-eval' is also required because React uses eval()
// to reconstruct server-side error stacks for debugging.
//
// Requirements: 11.5, 11.6
const isDev = process.env.NODE_ENV === "development";

const cspDirectives = [
  // Only load resources from the same origin by default.
  "default-src 'self'",

  // Scripts: allow same-origin + inline (required by Next.js hydration).
  // In dev, also allow eval() for React error overlays.
  isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'",

  // Styles: allow same-origin + inline (required by Tailwind CSS).
  "style-src 'self' 'unsafe-inline'",

  // Images: allow same-origin, blob: (canvas exports), and data: URIs
  // (base64-encoded images from PDF previews).
  "img-src 'self' blob: data:",

  // Fonts: same-origin only (Geist font is self-hosted via next/font).
  "font-src 'self'",

  // API connections: same-origin only.
  // External API calls (Pinecone, Hugging Face, Supabase) are made
  // server-side and never from the browser.
  "connect-src 'self'",

  // Disallow plugins (Flash, Java, etc.).
  "object-src 'none'",

  // Disallow <base> tag hijacking.
  "base-uri 'self'",

  // Restrict form submissions to same origin.
  "form-action 'self'",

  // Prevent this page from being embedded in iframes (clickjacking defence).
  "frame-ancestors 'none'",

  // Upgrade any accidental HTTP sub-resource requests to HTTPS.
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  // ── Content Security Policy (Req 11.5) ──────────────────────────────────
  {
    key: "Content-Security-Policy",
    value: cspDirectives,
  },

  // ── Prevent MIME-type sniffing (Req 11.6) ───────────────────────────────
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },

  // ── Clickjacking protection (belt-and-suspenders with frame-ancestors) ──
  {
    key: "X-Frame-Options",
    value: "DENY",
  },

  // ── Force HTTPS for 2 years, including subdomains ───────────────────────
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },

  // ── Limit referrer information sent to third parties ────────────────────
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },

  // ── Restrict browser feature access ─────────────────────────────────────
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },

  // ── DNS prefetch control ─────────────────────────────────────────────────
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
];

const nextConfig: NextConfig = {
  // Turbopack is the default bundler in Next.js 16 — no webpack config needed.
  // Top-level turbopack config (moved out of experimental in v16).
  turbopack: {},

  // Experimental features
  experimental: {
    // Filesystem caching for faster dev restarts (beta)
    turbopackFileSystemCacheForDev: true,

    // Optimize imports from packages with many named exports to reduce
    // initial bundle size (Req 12.4 — lazy-load / code-split dashboard).
    // Next.js will only bundle the modules actually used at build time.
    optimizePackageImports: [
      "@radix-ui/react-accordion",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-progress",
      "@radix-ui/react-slot",
      "@radix-ui/react-tooltip",
      "framer-motion",
      "date-fns",
    ],
  },

  // ── Security headers (Requirements: 11.5, 11.6) ─────────────────────────
  // Applied to all routes via the wildcard source pattern.
  // See: node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md
  async headers() {
    return [
      {
        // Apply to every route including API routes, pages, and static assets.
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
