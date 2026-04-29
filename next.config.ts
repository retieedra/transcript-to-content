import type { NextConfig } from "next";

/**
 * Resolve subpath hosting. Rejects junk env values that would break routing
 * (e.g. literal "undefined" from a mis-set CI var → would 404 every route).
 */
function resolveBasePath(): string | undefined {
  const raw = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").trim();
  if (!raw || raw === "/" || /^undefined|null$/i.test(raw)) {
    return undefined;
  }
  const normalized = raw.startsWith("/")
    ? raw.replace(/\/$/, "")
    : `/${raw.replace(/\/$/, "")}`;
  return normalized === "" ? undefined : normalized;
}

const basePath = resolveBasePath();

const nextConfig: NextConfig = {
  basePath,
  /**
   * With `basePath`, only prefixed URLs exist (e.g. `/preview/calibrate`).
   * Unprefixed `/`, `/calibrate`, `/export`, `/api/*` would 404; redirect those to the prefixed paths.
   */
  async redirects() {
    if (!basePath) return [];
    const p = basePath;
    return [
      { source: "/", destination: p, permanent: false, basePath: false },
      {
        source: "/calibrate",
        destination: `${p}/calibrate`,
        permanent: false,
        basePath: false,
      },
      {
        source: "/export",
        destination: `${p}/export`,
        permanent: false,
        basePath: false,
      },
      {
        source: "/api/:path*",
        destination: `${p}/api/:path*`,
        permanent: false,
        basePath: false,
      },
    ];
  },
};

export default nextConfig;
