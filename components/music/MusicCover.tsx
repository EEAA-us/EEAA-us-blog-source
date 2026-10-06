"use client";

import { useState, type ImgHTMLAttributes } from "react";
import { Disc3 } from "lucide-react";

export default function MusicCover({ src, alt = "", className = "", ...props }: Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { src?: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) return (
    <span className={`inline-flex items-center justify-center bg-slate-100 text-slate-400 dark:bg-slate-800 ${className}`} role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}>
      <Disc3 className="h-1/2 w-1/2" />
    </span>
  );
  // Album art has a same-origin URL from the music API; failed art gets a
  // neutral record icon instead of the browser's broken-image indicator.
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} src={src} alt={alt} className={className} onError={() => setFailedSrc(src)} />;
}
