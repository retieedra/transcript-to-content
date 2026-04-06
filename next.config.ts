import type { NextConfig } from "next";

const raw = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").trim();
const basePath =
  raw === "" || raw === "/"
    ? undefined
    : raw.startsWith("/")
      ? raw.replace(/\/$/, "")
      : `/${raw.replace(/\/$/, "")}`;

const nextConfig: NextConfig = {
  basePath,
};

export default nextConfig;
