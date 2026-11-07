import React, { useState, useEffect } from 'react';
import { Edit3, X, Check } from 'lucide-react';

interface EditMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialText: string;
  onSave: (newText: string) => void;
  theme?: 'adult' | 'teen' | 'kid';
}

export const EditMessageModal: React.FC<EditMessageModalProps> = ({
  isOpen,
  onClose,
  initialText,
  onSave,
  theme = 'adult'
}) => {
  const [text, setText] = useState(initialText);

  useEffect(() => {
    setText(initialText);
  }, [initialText, isOpen]);

  if (!isOpen) return null;

  const isDark = theme !== 'kid';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || text.trim() === initialText.trim()) {
      onClose();
      return;
    }
    onSave(text.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className={`w-full max-w-md rounded-3xl p-6 shadow-2xl relative border ${
        isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-amber-200 text-slate-900'
      }`}>
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 p-1 rounded-lg ${
            isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
            <Edit3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold">Editar mensaje</h3>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              El mensaje se re-encriptará y actualizará para todos
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            autoFocus
            className={`w-full p-3.5 rounded-2xl border text-sm resize-none focus:outline-none focus:border-indigo-500 ${
              isDark
                ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500'
                : 'bg-stone-50 border-stone-200 text-slate-900 placeholder-slate-400'
            }`}
            placeholder="Modifica tu mensaje..."
          />

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`py-2 px-4 rounded-xl text-xs font-semibold ${
                isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!text.trim() || text.trim() === initialText.trim()}
              className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 active:scale-95"
            >
              <Check className="w-4 h-4" /> Guardar cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
