/**
 * Prefix for this app when hosted under a subpath (see next.config.ts basePath).
 * Set NEXT_PUBLIC_BASE_PATH=/transcript in production; leave unset for local /.
 */
export function withBasePath(path: string): string {
  const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}
