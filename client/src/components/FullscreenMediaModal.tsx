import React from 'react';
import { X, Download, ZoomIn, ZoomOut, Image as ImageIcon } from 'lucide-react';

interface FullscreenMediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaUrl: string | null;
  title?: string;
  subtitle?: string;
}

export const FullscreenMediaModal: React.FC<FullscreenMediaModalProps> = ({
  isOpen,
  onClose,
  mediaUrl,
  title = 'Foto',
  subtitle
}) => {
  const [isZoomed, setIsZoomed] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setIsZoomed(false);
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !mediaUrl) return null;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = mediaUrl;
    a.download = `foto_${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex flex-col justify-between bg-black/95 backdrop-blur-md p-3 sm:p-5 select-none animate-in fade-in duration-150"
    >
      {/* Top Bar */}
      <div className="w-full flex items-center justify-between z-10 py-1">
        <div className="flex items-center gap-2.5 min-w-0 pr-2">
          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 flex-shrink-0">
            <ImageIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-white truncate">{title}</h3>
            {subtitle && <p className="text-[11px] text-slate-400 truncate">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsZoomed(!isZoomed)}
            className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title={isZoomed ? 'Alejar' : 'Acercar'}
          >
            {isZoomed ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div
        className="flex-1 flex items-center justify-center overflow-auto p-1 sm:p-4 my-2"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <img
          src={mediaUrl}
          alt={title}
          onClick={() => setIsZoomed(!isZoomed)}
          className={`rounded-2xl shadow-2xl transition-all cursor-zoom-in object-contain ${
            isZoomed
              ? 'max-h-none max-w-none w-auto cursor-zoom-out scale-125'
              : 'max-h-[78vh] w-auto max-w-full'
          }`}
        />
      </div>

      {/* Bottom Bar */}
      <div className="w-full flex items-center justify-between z-10 pt-2 border-t border-slate-800/60 max-w-xl mx-auto">
        <span className="text-[11px] text-slate-400">Toca la foto para ampliar</span>
        <button
          type="button"
          onClick={handleDownload}
          className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition-transform active:scale-95"
        >
          <Download className="w-4 h-4" /> Guardar en mi Carrete
        </button>
      </div>
    </div>
  );
};
