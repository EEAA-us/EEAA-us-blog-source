"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AlbumCard from "@/components/photos/AlbumCard";
import type { Album } from "@/components/photos/AlbumCard";
import Lightbox from "@/components/photos/Lightbox";
import type { Photo } from "@/data/photos";
import { articleCoverAlbum } from "@/data/article-covers";
import { builtinPhotoWallAlbums, fallbackPhotoWallAlbums, loadPhotoWallAlbums } from "@/lib/photo-wall-gallery";
import PageCover from "@/components/ui/PageCover";
import { useTranslation } from "@/lib/i18n";
import { ArrowLeft } from "lucide-react";
import { useAppearance } from "@/components/providers/AppearanceProvider";

export default function PhotoWallPage() {
  const { tx } = useTranslation();
  const { preferences, reducedMotion } = useAppearance();
  const [albums, setAlbums] = useState<Album[]>(builtinPhotoWallAlbums);
  const [personalLoading, setPersonalLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentPhotos, setCurrentPhotos] = useState<Photo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const expandedRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);
  const requestGenerationRef = useRef(0);

  useEffect(() => {
    if (expandedId === null) return;
    const handler = (e: MouseEvent) => {
      if (lightboxOpen) return;
      if (e.target instanceof Element && e.target.closest("[data-album-return]")) return;
      if (expandedRef.current && !expandedRef.current.contains(e.target as Node)) {
        setExpandedId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [expandedId, lightboxOpen]);

  useEffect(() => {
    mountedRef.current = true;
    const generation = ++requestGenerationRef.current;

    async function fetchData() {
      try {
        const results = await loadPhotoWallAlbums();
        if (!mountedRef.current || requestGenerationRef.current !== generation) return;
        setAlbums(results);
      } catch {
        if (!mountedRef.current || requestGenerationRef.current !== generation) return;
        setAlbums(fallbackPhotoWallAlbums);
      } finally {
        if (mountedRef.current && requestGenerationRef.current === generation) {
          setPersonalLoading(false);
        }
      }
    }
    fetchData();
    return () => {
      mountedRef.current = false;
      requestGenerationRef.current += 1;
    };
  }, []);

  const galleryItems = albums.map((album) => ({ key: String(album.id), album }));

  const openLightbox = (photos: Photo[], index: number) => {
    setCurrentPhotos(photos);
    setCurrentIndex(index);
    setLightboxOpen(true);
  };

  return (
    <>
      <PageCover title="照片墙" description="用照片记录生活的每一个瞬间" eyebrow="光影 · 日常 · 记忆" />
      <div id="page-content" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 relative z-10">
      {(expandedId === null || expandedId === articleCoverAlbum.id) && <p className="mb-6 text-sm leading-6 text-slate-500">{tx("未指定封面的文章从「文章封面库」选图，放大图片可查看来源。")}</p>}
      {expandedId !== null && (
        <div className="sticky top-20 z-20 mb-5 w-fit" data-album-return>
          <button type="button" className="editorial-panel detail-breadcrumb-link cursor-pointer px-5 py-2 font-medium hover:text-sky-500" onClick={() => {
            setExpandedId(null);
            requestAnimationFrame(() => requestAnimationFrame(() => {
              document.getElementById("page-content")?.scrollIntoView({ block: "start", behavior: preferences.navigationScroll === "smooth" && !reducedMotion ? "smooth" : "instant" });
            }));
          }}><ArrowLeft aria-hidden="true" />{tx("返回照片墙")}</button>
        </div>
      )}
      {personalLoading && (
        <div className="mb-5 flex items-center gap-2 text-xs text-slate-400" role="status">
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />{tx("正在加载站长相册…")}
        </div>
      )}

      {/* 后台相册和本地游戏精选相册 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6 select-none">
          {galleryItems.map((item) => {
            const album = item.album;
            const isExpanded = expandedId === album.id;
            const isHidden = expandedId !== null && !isExpanded;

            return (
              <AnimatePresence key={item.key}>
                {!isHidden && (
                  <motion.div
                    initial={false}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15 }}
                    className={isExpanded ? "sm:col-span-2 lg:col-span-3" : ""}
                  >
                    <div ref={isExpanded ? expandedRef : undefined}>
                      <AlbumCard
                        album={album}
                        isExpanded={isExpanded}
                        onToggle={() => setExpandedId((prev) => (prev === album.id ? null : album.id))}
                        onPhotoClick={openLightbox}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            );
          })}
      </div>

      {/* 灯箱 */}
      <Lightbox
        photos={currentPhotos}
        index={currentIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onPrev={() => setCurrentIndex((i) => (i - 1 + currentPhotos.length) % currentPhotos.length)}
        onNext={() => setCurrentIndex((i) => (i + 1) % currentPhotos.length)}
      />
      </div>
    </>
  );
}
