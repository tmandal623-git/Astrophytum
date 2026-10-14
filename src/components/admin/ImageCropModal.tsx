// src/components/admin/ImageCropModal.tsx
// Crop / zoom / rotate a photo before it is added to a cactus listing.
import { useEffect, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { Crop, RotateCcw, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';

// Every photo is cropped to 4:3, the shape of the product page's main photo
const CROP_ASPECT = 4 / 3;

// Clearly darken everything outside the frame, and give the frame a solid edge
const CROP_AREA_STYLE = { border: '2px solid #ffffff', boxShadow: '0 0 0 9999em rgba(0, 0, 0, 0.72)' };

const MAX_OUTPUT_SIDE = 2000;   // px — the upload step shrinks further if needed
const JPEG_QUALITY    = 0.92;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read this image'));
    img.src = src;
  });
}

// Draws the selected area (after rotation) onto a canvas and returns it as a JPEG file
async function cropToFile(source: File, src: string, area: Area, rotation: number): Promise<File> {
  const img = await loadImage(src);
  const rad = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad)), cos = Math.abs(Math.cos(rad));
  // Bounding box of the rotated image — react-easy-crop reports the area in this space
  const bw = img.naturalWidth * cos + img.naturalHeight * sin;
  const bh = img.naturalWidth * sin + img.naturalHeight * cos;

  const rotated = document.createElement('canvas');
  rotated.width = Math.round(bw); rotated.height = Math.round(bh);
  const rctx = rotated.getContext('2d')!;
  rctx.translate(bw / 2, bh / 2);
  rctx.rotate(rad);
  rctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

  const scale = Math.min(1, MAX_OUTPUT_SIDE / Math.max(area.width, area.height));
  const out = document.createElement('canvas');
  out.width = Math.round(area.width * scale); out.height = Math.round(area.height * scale);
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = '#ffffff';   // flatten PNG transparency onto white, like the upload step
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(rotated, area.x, area.y, area.width, area.height, 0, 0, out.width, out.height);

  const blob = await new Promise<Blob | null>(resolve => out.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
  if (!blob) throw new Error('Could not crop this image');
  const name = source.name.replace(/\.[^.]+$/, '') + '.jpg';
  return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
}

interface ImageCropModalProps {
  file:          File;
  /** e.g. "Photo 2 of 3" while several new photos are queued */
  progress?:     string;
  onApply:       (cropped: File) => void;
  /** Shown only when there is an earlier crop to undo */
  onUseOriginal?: () => void;
  onDiscard:     () => void;
  discardLabel?: string;
}

export function ImageCropModal({ file, progress, onApply, onUseOriginal, onDiscard, discardLabel = 'Remove photo' }: ImageCropModalProps) {
  // Created and released in the same effect, so StrictMode's double mount can't leave a revoked URL behind
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const [crop,       setCrop]       = useState({ x: 0, y: 0 });
  const [zoom,       setZoom]       = useState(1);
  const [rotation,   setRotation]   = useState(0);
  const [area,       setArea]       = useState<Area | null>(null);
  const [working,    setWorking]    = useState(false);
  const [error,      setError]      = useState('');

  // New photo → start fresh
  useEffect(() => { setCrop({ x: 0, y: 0 }); setZoom(1); setRotation(0); setArea(null); setError(''); }, [file]);

  const apply = async () => {
    if (!area || !src) return;
    setWorking(true); setError('');
    try { onApply(await cropToFile(file, src, area, rotation)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not crop this image'); }
    finally { setWorking(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[96dvh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
          <span className="w-8 h-8 rounded-lg bg-cactus-600 text-white flex items-center justify-center flex-shrink-0">
            <Crop className="w-4 h-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-lg text-gray-900 dark:text-white leading-tight">Crop &amp; adjust photo</h3>
            <p className="text-[11px] text-gray-400 truncate">{progress ? `${progress} · ` : ''}Drag to position, pinch or use the slider to zoom</p>
          </div>
        </div>

        {/* Crop area */}
        <div className="relative w-full h-[46dvh] sm:h-[380px] bg-gray-950 flex-shrink-0">
          {src && (
            <Cropper
              image={src}
              crop={crop} zoom={zoom} rotation={rotation} aspect={CROP_ASPECT}
              minZoom={1} maxZoom={4} zoomSpeed={0.2} showGrid
              onCropChange={setCrop} onZoomChange={setZoom} onRotationChange={setRotation}
              onCropComplete={(_, pixels) => setArea(pixels)}
              style={{ cropAreaStyle: CROP_AREA_STYLE }}
            />
          )}
        </div>

        {/* Controls */}
        <div className="px-4 sm:px-5 py-4 flex flex-col gap-4 overflow-y-auto">
          {/* Zoom + rotate */}
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setZoom(z => Math.max(1, +(z - 0.2).toFixed(2)))} aria-label="Zoom out"
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"><ZoomOut className="w-4 h-4" aria-hidden /></button>
            <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={e => setZoom(Number(e.target.value))}
              aria-label="Zoom" className="flex-1 accent-cactus-600 cursor-pointer" />
            <button type="button" onClick={() => setZoom(z => Math.min(4, +(z + 0.2).toFixed(2)))} aria-label="Zoom in"
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"><ZoomIn className="w-4 h-4" aria-hidden /></button>
            <span className="w-px h-6 bg-gray-200 dark:bg-gray-700" aria-hidden />
            <button type="button" onClick={() => setRotation(r => (r + 270) % 360)} aria-label="Rotate left"
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"><RotateCcw className="w-4 h-4" aria-hidden /></button>
            <button type="button" onClick={() => setRotation(r => (r + 90) % 360)} aria-label="Rotate right"
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"><RotateCw className="w-4 h-4" aria-hidden /></button>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3.5 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <button type="button" onClick={onDiscard}
            className="px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors">
            {discardLabel}
          </button>
          <div className="flex items-center gap-2 ml-auto">
            {onUseOriginal && (
              <button type="button" onClick={onUseOriginal} disabled={working}
                className="px-4 py-2 text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-60">
                Use original
              </button>
            )}
            <button type="button" onClick={apply} disabled={working || !area || !src}
              className="px-5 py-2 bg-cactus-600 hover:bg-cactus-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2">
              {working ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Cropping…</> : <><Crop className="w-4 h-4" aria-hidden />Apply crop</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
