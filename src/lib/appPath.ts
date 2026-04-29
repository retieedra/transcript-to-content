/**
 * Prefix for this app when hosted under a subpath (see next.config.ts basePath).
 * Set NEXT_PUBLIC_BASE_PATH=/transcript in production; leave unset for local /.
 */
function clientBase(): string {
  const raw = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").trim();
  if (!raw || raw === "/" || /^undefined|null$/i.test(raw)) return "";
  return raw.startsWith("/") ? raw.replace(/\/$/, "") : `/${raw.replace(/\/$/, "")}`;
}

export function withBasePath(path: string): string {
  const base = clientBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}
