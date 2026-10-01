// src/components/cactus/CactusGallery.tsx
// Main image (large) + all images as a single horizontal thumbnail strip.
// Thumbnails are always visible regardless of count.

import { useState } from 'react';
import { MediaItem } from '../../types';
import { cn } from '../../utils/cn';

interface CactusGalleryProps {
  media: MediaItem[];
  name:  string;
}

export function CactusGallery({ media, name }: CactusGalleryProps) {
  const images = media.filter((m) => m.type === 'Image');
  const video  = media.find((m)  => m.type === 'Video');

  const [activeIndex,  setActiveIndex]  = useState(0);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [imgError,     setImgError]     = useState<Record<number, boolean>>({});

  const activeImage = images[activeIndex];

  const prevImage = () =>
    setActiveIndex((i) => (i === 0 ? images.length - 1 : i - 1));
  const nextImage = () =>
    setActiveIndex((i) => (i === images.length - 1 ? 0 : i + 1));

  return (
    <div className="flex flex-col gap-2.5">

      {/* ── Main image ───────────────────────────────────────── */}
      <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-cactus-50 dark:bg-cactus-950 border border-gray-200 dark:border-gray-700 group">

        {activeImage && !imgError[activeIndex] ? (
          <img
            key={activeImage.url}
            src={activeImage.url}
            alt={`${name} — photo ${activeIndex + 1}`}
            className="w-full h-full object-cover transition-opacity duration-300"
            onError={() => setImgError(prev => ({ ...prev, [activeIndex]: true }))}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-8xl select-none opacity-30">
            🌵
          </div>
        )}

        {/* Prev / Next — only when >1 image */}
        {images.length > 1 && (
          <>
            <button
              onClick={prevImage}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center text-lg [@media(hover:hover)]:opacity-0 group-hover:opacity-100 transition-all hover:bg-black/60 hover:scale-105"
              aria-label="Previous image"
            >
              ‹
            </button>
            <button
              onClick={nextImage}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center text-lg [@media(hover:hover)]:opacity-0 group-hover:opacity-100 transition-all hover:bg-black/60 hover:scale-105"
              aria-label="Next image"
            >
              ›
            </button>
          </>
        )}

        {/* Image counter badge */}
        {images.length > 1 && (
          <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-full">
            {activeIndex + 1} / {images.length}
          </div>
        )}
      </div>

      {/* ── Thumbnail strip — always horizontal, all 5 in one row ── */}
      {images.length > 0 && (
        <div className="flex gap-2">
          {images.map((img, i) => (
            <button
              key={img.id ?? i}
              onClick={() => setActiveIndex(i)}
              className={cn(
                // Each thumb takes equal width in the row
                'flex-1 aspect-square rounded-lg overflow-hidden border-2 transition-all duration-150 flex-shrink-0',
                i === activeIndex
                  ? 'border-cactus-500 ring-2 ring-cactus-300 dark:ring-cactus-700 opacity-100'
                  : 'border-transparent opacity-55 hover:opacity-85 hover:border-gray-300 dark:hover:border-gray-600',
              )}
              aria-label={`View photo ${i + 1}`}
            >
              {!imgError[i] ? (
                <img
                  src={img.url}
                  alt={`${name} thumbnail ${i + 1}`}
                  className="w-full h-full object-cover"
                  onError={() => setImgError(prev => ({ ...prev, [i]: true }))}
                />
              ) : (
                <div className="w-full h-full bg-cactus-50 dark:bg-cactus-950 flex items-center justify-center text-lg opacity-40">
                  🌵
                </div>
              )}
            </button>
          ))}

          {/* Empty placeholder slots up to 5 — keeps layout consistent */}
          {images.length < 5 && Array.from({ length: 5 - images.length }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="flex-1 aspect-square rounded-lg border-2 border-dashed border-gray-100 dark:border-gray-800 flex-shrink-0"
            />
          ))}
        </div>
      )}

      {/* ── Video ────────────────────────────────────────────── */}
      {video && (
        <div className="mt-1">
          {videoPlaying ? (
            <div className="rounded-xl overflow-hidden aspect-video border border-gray-200 dark:border-gray-700">
              <iframe
                src={video.url}
                title={`${name} care guide video`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <button
              onClick={() => setVideoPlaying(true)}
              className="w-full flex items-center gap-4 bg-gray-900 dark:bg-gray-800 text-white rounded-xl px-5 py-4 hover:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">Watch Care Guide</p>
                <p className="text-xs text-white/50 mt-0.5">Video · Click to play</p>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}