import React, { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, X, Check, Lock, Sparkles } from 'lucide-react';

interface PhotoSenderProps {
  onSendPhoto: (compressedBlob: Blob, isProtected?: boolean) => void;
  theme?: 'kid' | 'teen' | 'adult';
  isRecipientMinor?: boolean;
}

export const PhotoSender: React.FC<PhotoSenderProps> = ({
  onSendPhoto,
  theme = 'adult',
  isRecipientMinor = false
}) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedBlob, setSelectedBlob] = useState<Blob | null>(null);
  const [isProtected, setIsProtected] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setShowSourceModal(false);
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (event) => {
      img.src = event.target?.result as string;
      img.onload = () => {
        // Client-side canvas compression for snappy encryption & upload
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1280;
        const scale = Math.min(1, MAX_WIDTH / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                setSelectedBlob(blob);
                setPreviewUrl(URL.createObjectURL(blob));
              }
            },
            'image/jpeg',
            0.82
          );
        }
      };
    };

    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input value so same photo can be re-selected if needed
  };

  const confirmSend = () => {
    if (selectedBlob) {
      // If recipient is a minor, strictly disable protection
      const finalProtected = isRecipientMinor ? false : isProtected;
      onSendPhoto(selectedBlob, finalProtected);
      closePreview();
    }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSelectedBlob(null);
    setIsProtected(false);
  };

  return (
    <>
      {/* Hidden file inputs for Camera and Gallery */}
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        type="file"
        ref={galleryInputRef}
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Main Trigger Button */}
      {theme === 'kid' ? (
        <button
          type="button"
          onClick={() => setShowSourceModal(true)}
          className="flex items-center justify-center w-11 h-11 sm:w-14 sm:h-14 bg-sky-500 hover:bg-sky-600 active:scale-95 text-white rounded-full shadow-lg transition-transform flex-shrink-0"
          title="Tomar o Enviar Foto"
        >
          <Camera className="w-6 h-6 sm:w-8 sm:h-8" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setShowSourceModal(true)}
          className={`p-2.5 rounded-full transition-all ${
            theme === 'teen'
              ? 'bg-slate-800 text-cyan-400 hover:bg-slate-700'
              : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
          }`}
          title="Adjuntar Foto Cifrada"
        >
          <ImageIcon className="w-5 h-5" />
        </button>
      )}

      {/* Choice Modal: Camera vs Gallery */}
      {showSourceModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-sm w-full shadow-2xl flex flex-col gap-3 text-white animate-in fade-in zoom-in-95 duration-150">
            <div className="text-center pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Enviar Foto Familiar</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Elige el origen de tu imagen cifrada</p>
            </div>

            <button
              type="button"
              onClick={() => {
                cameraInputRef.current?.click();
                setShowSourceModal(false);
              }}
              className="w-full py-3.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-2.5 shadow-md transition-all"
            >
              <Camera className="w-5 h-5" />
              Tomar Foto con la Cámara
            </button>

            <button
              type="button"
              onClick={() => {
                galleryInputRef.current?.click();
                setShowSourceModal(false);
              }}
              className="w-full py-3.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-750 active:scale-95 border border-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2.5 shadow-sm transition-all"
            >
              <ImageIcon className="w-5 h-5 text-indigo-400" />
              Elegir de mi Carrete / Galería
            </button>

            <button
              type="button"
              onClick={() => setShowSourceModal(false)}
              className="w-full py-2.5 rounded-xl text-slate-400 hover:text-white text-xs font-semibold transition-colors mt-1"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Preview Modal before local encryption */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-sm w-full shadow-2xl flex flex-col items-center gap-4 text-white">
            <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-slate-950 border border-slate-800">
              <img src={previewUrl} alt="Vista previa" className="w-full h-full object-cover" />
              {isProtected && !isRecipientMinor && (
                <div className="absolute top-3 right-3 px-2.5 py-1 bg-amber-500/90 text-slate-950 rounded-full text-[11px] font-bold flex items-center gap-1 shadow-md">
                  <Lock className="w-3.5 h-3.5" /> Protegida con PIN
                </div>
              )}
            </div>

            {/* Toggle: Protected with PIN (Only visible if recipient is NOT a minor) */}
            {!isRecipientMinor ? (
              <button
                type="button"
                onClick={() => setIsProtected(!isProtected)}
                className={`w-full py-2.5 px-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-between transition-all ${
                  isProtected
                    ? 'border-amber-500 bg-amber-500/20 text-amber-300 shadow-sm'
                    : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Lock className={`w-4 h-4 ${isProtected ? 'text-amber-400' : 'text-slate-400'}`} />
                  <span className="text-left">Proteger con PIN (Foto confidencial)</span>
                </div>
                <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] flex-shrink-0 ${
                  isProtected ? 'bg-amber-400 border-amber-300 text-slate-950 font-black' : 'border-slate-600'
                }`}>
                  {isProtected ? '✓' : ''}
                </span>
              </button>
            ) : (
              <div className="w-full py-2 px-3 rounded-xl bg-slate-800/40 border border-slate-800 text-[11px] text-slate-400 text-center flex items-center justify-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Protección infantil activa: fotos con PIN exclusivas entre adultos</span>
              </div>
            )}

            <div className="flex w-full justify-between gap-3">
              <button
                type="button"
                onClick={closePreview}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <X className="w-4 h-4" /> Cancelar
              </button>
              <button
                type="button"
                onClick={confirmSend}
                className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
              >
                <Check className="w-4 h-4" /> Enviar Cifrada
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
