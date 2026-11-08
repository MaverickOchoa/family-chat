import React, { useState, useRef, useEffect } from 'react';
import { X, Check, ZoomIn, ZoomOut, RotateCcw, Move } from 'lucide-react';

interface AvatarCropperModalProps {
  isOpen: boolean;
  imageSrc: string;
  onClose: () => void;
  onCropComplete: (croppedDataUrl: string) => void;
}

export const AvatarCropperModal: React.FC<AvatarCropperModalProps> = ({
  isOpen,
  imageSrc,
  onClose,
  onCropComplete
}) => {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const currentOffsetRef = useRef({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      currentOffsetRef.current = { x: 0, y: 0 };
    }
  }, [isOpen, imageSrc]);

  if (!isOpen) return null;

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const newX = e.clientX - dragStartRef.current.x;
    const newY = e.clientY - dragStartRef.current.y;
    setOffset({ x: newX, y: newY });
    currentOffsetRef.current = { x: newX, y: newY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {}
  };

  const handleConfirmCrop = () => {
    const img = imageRef.current;
    if (!img) return;

    const canvas = document.createElement('canvas');
    const TARGET_SIZE = 512;
    canvas.width = TARGET_SIZE;
    canvas.height = TARGET_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Viewport box is 260px in modal UI
    const viewportSize = 260;
    const scaleFactor = TARGET_SIZE / viewportSize;

    // Calculate crop parameters
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, TARGET_SIZE, TARGET_SIZE);

    // Save and clip to circle
    ctx.beginPath();
    ctx.arc(TARGET_SIZE / 2, TARGET_SIZE / 2, TARGET_SIZE / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    const baseScale = Math.max(viewportSize / naturalWidth, viewportSize / naturalHeight);
    const finalWidth = naturalWidth * baseScale * zoom;
    const finalHeight = naturalHeight * baseScale * zoom;

    const drawX = ((viewportSize - finalWidth) / 2 + offset.x) * scaleFactor;
    const drawY = ((viewportSize - finalHeight) / 2 + offset.y) * scaleFactor;
    const drawW = finalWidth * scaleFactor;
    const drawH = finalHeight * scaleFactor;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    const croppedBase64 = canvas.toDataURL('image/jpeg', 0.9);
    onCropComplete(croppedBase64);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-sm w-full shadow-2xl flex flex-col items-center gap-4 text-white">
        {/* Header */}
        <div className="w-full flex items-center justify-between pb-2 border-b border-slate-800">
          <div>
            <h3 className="font-bold text-sm text-white">Ajustar Foto de Perfil</h3>
            <p className="text-[11px] text-slate-400">Arrastra para centrar y usa el zoom</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Circular Viewport */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="relative w-[260px] h-[260px] rounded-full overflow-hidden bg-slate-950 border-4 border-indigo-500/80 shadow-2xl cursor-grab active:cursor-grabbing select-none touch-none flex items-center justify-center"
        >
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Para recortar"
            draggable={false}
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              transition: isDragging ? 'none' : 'transform 0.05s ease-out',
              maxWidth: 'none'
            }}
            className="w-full h-full object-cover pointer-events-none select-none"
          />

          {/* Guide Overlay Grid */}
          <div className="absolute inset-0 pointer-events-none border border-white/20 rounded-full flex items-center justify-center">
            <div className="w-1/3 h-full border-x border-white/10" />
            <div className="h-1/3 w-full border-y border-white/10 absolute" />
          </div>

          <div className="absolute bottom-2 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur text-[10px] text-slate-300 flex items-center gap-1 pointer-events-none">
            <Move className="w-3 h-3" /> Mover imagen
          </div>
        </div>

        {/* Zoom Slider */}
        <div className="w-full space-y-1.5 px-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1"><ZoomOut className="w-3.5 h-3.5" /> Alejar</span>
            <span className="font-mono text-[11px] text-indigo-400 font-bold">{Math.round(zoom * 100)}%</span>
            <span className="flex items-center gap-1">Acercar <ZoomIn className="w-3.5 h-3.5" /></span>
          </div>
          <input
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-full accent-indigo-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
          />
        </div>

        {/* Bottom Actions */}
        <div className="flex w-full gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setOffset({ x: 0, y: 0 });
            }}
            className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
            title="Restablecer encuadre"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-3 rounded-2xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold transition-colors text-center"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirmCrop}
            className="flex-1 py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
          >
            <Check className="w-4 h-4" /> Aplicar
          </button>
        </div>
      </div>
    </div>
  );
};
