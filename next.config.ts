import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Content-Security-Policy. В dev ослабляем под HMR (eval + websockets),
// в проде — строгий вариант + апгрейд на HTTPS.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  // HSTS отправляем только в проде (на http/localhost он вреден).
  ...(isDev
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]),
];

const nextConfig: NextConfig = {
  // Лёгкий продакшен-образ для Docker (минимальный standalone-сервер).
  output: "standalone",
  // Не светим, что это Next.js.
  poweredByHeader: false,

  // ВАЖНО (только для локальной Windows-машины): встроенный в `next build`
  // шаг проверки типов роняет воркер. Тип-чек вынесен в `npm run typecheck`
  // (tsc --noEmit) — проходит чисто. На Linux/в Docker можно убрать.
  typescript: {
    ignoreBuildErrors: true,
  },

  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
