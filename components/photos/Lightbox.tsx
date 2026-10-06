"use client";

import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import type { Photo } from "@/data/photos";
import { useTranslation } from "@/lib/i18n";
import { useAppearance } from "@/components/providers/AppearanceProvider";

interface LightboxProps {
  photos: Photo[];
  index: number;
  open: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export default function Lightbox({
  photos,
  index,
  open,
  onClose,
  onPrev,
  onNext,
}: LightboxProps) {
  const photo = photos[index];
  const { tx } = useTranslation();
  const { reducedMotion } = useAppearance();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    },
    [open, onClose, onPrev, onNext]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // 打开时禁止背景滚动
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && photo && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.15 }}
          role="dialog"
          aria-modal="true"
          aria-label={photo.caption || tx("图片预览")}
          data-photo-lightbox
          className="fixed inset-0 z-[10000] flex items-center justify-center"
          onClick={onClose}
        >
          {/* 背景遮罩 */}
          <div className="absolute inset-0 bg-black/85" />

          {/* 关闭按钮 */}
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); onClose(); }}
            title={tx("关闭")}
            aria-label={tx("关闭")}
            className="absolute top-4 right-4 z-30 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          {/* 左箭头 */}
          {photos.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onPrev(); }}
              aria-label={tx("上一张")}
              className="absolute left-4 z-30 cursor-pointer p-3 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* 右箭头 */}
          {photos.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onNext(); }}
              aria-label={tx("下一张")}
              className="absolute right-4 z-30 cursor-pointer p-3 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* 图片 */}
          <motion.div
            key={photo.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reducedMotion ? 0 : 0.15 }}
            className="relative z-10 max-w-[90vw] max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={photo.url}
              alt={photo.caption || "照片"}
              width={photo.width ?? 1600}
              height={photo.height ?? 1200}
              sizes="90vw"
              unoptimized={photo.url.startsWith("/images/games/") || photo.url.startsWith("/images/anime-stills/") || photo.url.startsWith("/images/article-covers/")}
              className="max-h-[80svh] max-w-[90vw] h-auto w-auto object-contain rounded-lg shadow-2xl"
              priority
            />
            {/* caption */}
            {photo.caption && (
              <div className="absolute -bottom-10 left-0 right-0 text-center">
                <span className="text-sm text-white/70 font-serif italic">
                  {photo.caption}
                </span>
              </div>
            )}
          </motion.div>

          {/* 页码 */}
          {photos.length > 1 && (
            <div className="absolute bottom-4 left-0 right-0 text-center z-10">
              <span className="text-sm text-white/50">
                {index + 1} / {photos.length}
              </span>
            </div>
          )}
          {photo.sourceUrl && (
            <a
              href={photo.sourceUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="absolute bottom-4 left-4 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-xs text-white/75 transition-colors hover:bg-white/20 hover:text-white"
            >
              <ExternalLink className="h-3.5 w-3.5" />{tx("查看图片来源")}
            </a>
          )}
        </motion.div>
      )}
    </AnimatePresence>, document.body
  );
}
