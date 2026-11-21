import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Image as ImageIcon, X, Check, Lock, Sparkles, Send } from 'lucide-react';

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

      {/* Choice Modal: Camera vs Gallery (Portaled to document.body so it is never trapped by footer CSS) */}
      {showSourceModal && typeof document !== 'undefined' && createPortal(
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSourceModal(false);
          }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto"
        >
          <div
            className={`max-w-sm w-full rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col gap-3 my-auto animate-in fade-in zoom-in-95 duration-150 ${
              theme === 'kid'
                ? 'bg-amber-50 border-3 border-amber-300 text-amber-950'
                : 'bg-slate-900 border border-slate-800 text-white'
            }`}
          >
            <div className="text-center pb-2 border-b border-black/10 dark:border-slate-800">
              <h3 className={`font-black ${theme === 'kid' ? 'text-lg text-amber-950' : 'text-sm text-white'}`}>
                {theme === 'kid' ? '📸 Enviar una Foto' : 'Enviar Foto Familiar'}
              </h3>
              <p className={`text-xs mt-0.5 ${theme === 'kid' ? 'text-amber-700 font-semibold' : 'text-slate-400'}`}>
                {theme === 'kid' ? '¿Quieres tomarla ahora o elegir de tus fotos?' : 'Elige el origen de tu imagen cifrada'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                cameraInputRef.current?.click();
                setShowSourceModal(false);
              }}
              className={`w-full py-3.5 px-4 rounded-2xl active:scale-95 flex items-center justify-center gap-2.5 shadow-md transition-all ${
                theme === 'kid'
                  ? 'bg-sky-500 hover:bg-sky-600 text-white font-black text-sm border-2 border-sky-400'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold'
              }`}
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
              className={`w-full py-3.5 px-4 rounded-2xl active:scale-95 flex items-center justify-center gap-2.5 shadow-sm transition-all ${
                theme === 'kid'
                  ? 'bg-amber-400 hover:bg-amber-500 text-amber-950 font-black text-sm border-2 border-amber-500'
                  : 'bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 text-xs font-bold'
              }`}
            >
              <ImageIcon className={`w-5 h-5 ${theme === 'kid' ? 'text-amber-900' : 'text-indigo-400'}`} />
              Elegir de mi Carrete / Galería
            </button>

            <button
              type="button"
              onClick={() => setShowSourceModal(false)}
              className={`w-full py-2.5 rounded-xl font-bold text-xs transition-colors mt-1 ${
                theme === 'kid'
                  ? 'bg-amber-200 hover:bg-amber-300 text-amber-800'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Cancelar
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Preview Modal before local encryption (Portaled to document.body) */}
      {previewUrl && typeof document !== 'undefined' && createPortal(
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) closePreview();
          }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 overflow-y-auto"
        >
          <div
            className={`max-w-md w-full max-h-[92dvh] rounded-3xl shadow-2xl flex flex-col p-4 sm:p-5 my-auto animate-in fade-in zoom-in-95 duration-150 ${
              theme === 'kid'
                ? 'bg-amber-50 border-3 border-amber-300 text-amber-950'
                : 'bg-slate-900 border border-slate-800 text-white'
            }`}
          >
            {/* Header with Title and Cancel 'X' */}
            <div className="flex items-center justify-between pb-3 border-b flex-shrink-0 mb-3 border-black/10 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Sparkles className={`w-5 h-5 ${theme === 'kid' ? 'text-amber-500' : 'text-indigo-400'}`} />
                <h3 className={`font-black ${theme === 'kid' ? 'text-lg text-amber-950' : 'text-sm text-white'}`}>
                  {theme === 'kid' ? '¡Tu Foto!' : 'Vista previa de la foto'}
                </h3>
              </div>
              <button
                type="button"
                onClick={closePreview}
                className={`p-1.5 rounded-full transition-colors ${
                  theme === 'kid'
                    ? 'hover:bg-amber-200 text-amber-800'
                    : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                }`}
                title="Cerrar y descartar foto"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Image Preview Box with adaptive containment (never overflows tablet/phone viewport) */}
            <div className="relative flex-1 min-h-0 flex items-center justify-center rounded-2xl overflow-hidden bg-black/40 border border-black/10 p-1 mb-3">
              <img
                src={previewUrl}
                alt="Vista previa"
                className="max-h-[38vh] sm:max-h-[46vh] w-auto max-w-full object-contain rounded-xl shadow-md"
              />
              {isProtected && !isRecipientMinor && (
                <div className="absolute top-3 right-3 px-2.5 py-1 bg-amber-500 text-slate-950 rounded-full text-[11px] font-bold flex items-center gap-1 shadow-md">
                  <Lock className="w-3.5 h-3.5" /> Protegida con PIN
                </div>
              )}
            </div>

            {/* Toggle: Protected with PIN (Only visible if recipient is NOT a minor AND not kid theme) */}
            {!isRecipientMinor && theme !== 'kid' && (
              <button
                type="button"
                onClick={() => setIsProtected(!isProtected)}
                className={`w-full py-2.5 px-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-between transition-all flex-shrink-0 mb-3 ${
                  isProtected
                    ? 'border-amber-500 bg-amber-500/20 text-amber-300 shadow-sm'
                    : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Lock className={`w-4 h-4 ${isProtected ? 'text-amber-400' : 'text-slate-400'}`} />
                  <span className="text-left">Proteger con PIN (Foto confidencial)</span>
                </div>
                <span
                  className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] flex-shrink-0 ${
                    isProtected ? 'bg-amber-400 border-amber-300 text-slate-950 font-black' : 'border-slate-600'
                  }`}
                >
                  {isProtected ? '✓' : ''}
                </span>
              </button>
            )}

            {/* Action Buttons: Always in viewport and flex-shrink-0 */}
            <div className="flex w-full justify-between gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={closePreview}
                className={`flex-1 py-3 px-4 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${
                  theme === 'kid'
                    ? 'bg-amber-200 hover:bg-amber-300 text-amber-900 border-2 border-amber-300'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                <X className="w-4 h-4" /> Cancelar
              </button>
              <button
                type="button"
                onClick={confirmSend}
                className={`flex-1 py-3 px-4 rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 ${
                  theme === 'kid'
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white text-sm sm:text-base border-2 border-emerald-400 shadow-emerald-500/30'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white text-xs'
                }`}
              >
                <Send className="w-4 h-4" /> {theme === 'kid' ? '¡Enviar Foto!' : 'Enviar Cifrada'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
