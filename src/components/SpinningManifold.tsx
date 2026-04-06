"use client";

import { withBasePath } from "@/lib/appPath";

/**
 * Plain <img> avoids next/image URL differences between SSR and the browser,
 * which otherwise trigger hydration errors and can hide the graphic.
 */
export function SpinningManifold() {
  return (
    <div className="manifold-wrap mx-auto mb-10 flex justify-center" aria-hidden>
      <div className="manifold-spin shrink-0">
        <img
          src={withBasePath("/manifold.png")}
          alt=""
          width={160}
          height={160}
          className="block h-32 w-32 object-contain sm:h-40 sm:w-40"
          decoding="async"
          fetchPriority="high"
        />
      </div>
    </div>
  );
}
