import React, { useCallback, useEffect, useRef, useState } from 'react';

const OUTPUT_SIZE = 512;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

/**
 * Modal cadrage image : zoom + déplacement, export carré JPEG.
 */
export default function V2ImageCropModal({ imageSrc, onCancel, onConfirm, busy }) {
  const viewportRef = useRef(null);
  const imgRef = useRef(null);
  const dragRef = useRef(null);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [viewport, setViewport] = useState(280);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;
    const measure = () => {
      const side = Math.min(el.clientWidth || 280, 360);
      setViewport(side);
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  const onImageLoad = (e) => {
    const img = e.currentTarget;
    setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setReady(true);
  };

  /** Taille affichée de l’image pour couvrir le viewport au zoom donné. */
  const coverBase = (() => {
    if (!imgSize.w || !imgSize.h || !viewport) return { w: 0, h: 0 };
    const scale = Math.max(viewport / imgSize.w, viewport / imgSize.h);
    return { w: imgSize.w * scale, h: imgSize.h * scale };
  })();

  const displayW = coverBase.w * zoom;
  const displayH = coverBase.h * zoom;

  const clampOffset = useCallback(
    (x, y, z = zoom) => {
      const dw = coverBase.w * z;
      const dh = coverBase.h * z;
      const maxX = Math.max(0, (dw - viewport) / 2);
      const maxY = Math.max(0, (dh - viewport) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, x)),
        y: Math.min(maxY, Math.max(-maxY, y)),
      };
    },
    [coverBase.w, coverBase.h, viewport, zoom]
  );

  useEffect(() => {
    setOffset((prev) => clampOffset(prev.x, prev.y, zoom));
  }, [zoom, clampOffset]);

  const onPointerDown = (e) => {
    if (!ready || busy) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: offset.x,
      origY: offset.y,
    };
  };

  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset(
      clampOffset(dragRef.current.origX + dx, dragRef.current.origY + dy)
    );
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const handleConfirm = async () => {
    if (!ready || !imgRef.current || busy) return;
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Mapping viewport → image naturelle
    // Coin haut-gauche du cadre dans l’espace image affichée (centré + offset)
    const left = (displayW - viewport) / 2 - offset.x;
    const top = (displayH - viewport) / 2 - offset.y;
    const scaleToNatural = imgSize.w / displayW;

    const sx = left * scaleToNatural;
    const sy = top * scaleToNatural;
    const sSize = viewport * scaleToNatural;

    ctx.fillStyle = '#0c0a09';
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    ctx.drawImage(imgRef.current, sx, sy, sSize, sSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    onConfirm?.(dataUrl);
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-xl border border-stone-600 bg-stone-900 shadow-2xl p-4 space-y-4">
        <div>
          <h3 className="text-lg font-bold text-amber-400">Cadrer l’image</h3>
          <p className="text-xs text-stone-400 mt-1">
            Zoom et déplace pour cadrer ton champion dans le carré.
          </p>
        </div>

        <div
          ref={viewportRef}
          className="relative mx-auto w-full max-w-[360px] aspect-square rounded-lg overflow-hidden border-2 border-amber-500/70 bg-stone-950 touch-none cursor-grab active:cursor-grabbing select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {imageSrc && (
            <img
              ref={imgRef}
              src={imageSrc}
              alt=""
              draggable={false}
              onLoad={onImageLoad}
              className="absolute left-1/2 top-1/2 max-w-none pointer-events-none"
              style={{
                width: displayW || 'auto',
                height: displayH || 'auto',
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
              }}
            />
          )}
          {/* Coins du cadre */}
          <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_2px_rgba(251,191,36,0.5)]" />
        </div>

        <label className="block space-y-1">
          <div className="flex justify-between text-xs text-stone-400">
            <span>Zoom</span>
            <span>{zoom.toFixed(1)}×</span>
          </div>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.05}
            value={zoom}
            disabled={!ready || busy}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-amber-500"
          />
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg border border-stone-600 text-stone-300 text-sm hover:bg-stone-800 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={!ready || busy}
            onClick={handleConfirm}
            className="flex-1 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-sm disabled:opacity-50"
          >
            {busy ? 'Upload…' : 'Valider le cadre'}
          </button>
        </div>
      </div>
    </div>
  );
}
