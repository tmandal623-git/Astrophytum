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

  const [activeIndex, setActiveIndex] = useState(0);
  const [videoPlaying, setVideoPlaying] = useState(false);

  const activeImage = images[activeIndex];

  const prevImage = () => setActiveIndex((i) => (i === 0 ? images.length - 1 : i - 1));
  const nextImage = () => setActiveIndex((i) => (i === images.length - 1 ? 0 : i + 1));

  return (
    <div className="flex flex-col gap-3">

      {/* Main image */}
      <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-cactus-50 dark:bg-cactus-900 border border-gray-200 dark:border-gray-700 group">
        {activeImage ? (
          <img
            key={activeImage.url}
            src={activeImage.url}
            alt={`${name} — photo ${activeIndex + 1}`}
            className="w-full h-full object-cover transition-opacity duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-8xl select-none">🌵</div>
        )}

        {/* Prev / Next arrows — only shown when multiple images */}
        {images.length > 1 && (
          <>
            <button
              onClick={prevImage}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white
                         flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
              aria-label="Previous image"
            >
              ‹
            </button>
            <button
              onClick={nextImage}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white
                         flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
              aria-label="Next image"
            >
              ›
            </button>
          </>
        )}

        {/* Index indicator */}
        {images.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className={cn(
                  'w-1.5 h-1.5 rounded-full transition-all duration-200',
                  i === activeIndex ? 'bg-white w-4' : 'bg-white/50',
                )}
                aria-label={`Go to image ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setActiveIndex(i)}
              className={cn(
                'aspect-square rounded-lg overflow-hidden border-2 transition-all duration-150',
                i === activeIndex
                  ? 'border-cactus-500 opacity-100 ring-2 ring-cactus-300 dark:ring-cactus-700'
                  : 'border-transparent opacity-60 hover:opacity-90 hover:border-gray-300',
              )}
            >
              <img src={img.url} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Video embed */}
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
              className="w-full flex items-center gap-4 bg-gray-900 dark:bg-gray-800 text-white
                         rounded-xl px-5 py-4 hover:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
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
