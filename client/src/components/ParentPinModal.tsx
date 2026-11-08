import React, { useState } from 'react';
import { Lock, X, ShieldAlert } from 'lucide-react';

interface ParentPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
}

export const ParentPinModal: React.FC<ParentPinModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  title = 'Autorización del Padre / Guardián',
  description = 'Por seguridad infantil, esta acción (borrado o cambio) requiere el PIN de guardián.'
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Default parental pin or saved pin in localStorage
    const savedPin = localStorage.getItem('family_guardian_pin') || '1234';
    if (pin === savedPin) {
      setError(false);
      setPin('');
      onSuccess();
      onClose();
    } else {
      setError(true);
      setPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{title}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">{description}</p>

          <form onSubmit={handleSubmit} className="w-full flex flex-col items-center">
            <input
              type="password"
              maxLength={6}
              value={pin}
              autoFocus
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              className="w-40 text-center text-3xl tracking-[0.5em] font-mono py-2 px-4 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 mb-4"
            />

            {error && (
              <div className="flex items-center gap-1 text-red-500 text-xs mb-3 font-medium">
                <ShieldAlert className="w-4 h-4" /> PIN incorrecto. Inténtalo de nuevo.
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-medium rounded-xl transition-all shadow-md"
            >
              Desbloquear Acción
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
