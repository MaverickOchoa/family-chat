import React from 'react';
import { Eraser, Trash2, UserMinus, X, Lock } from 'lucide-react';

interface ClearChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClearForMe: () => void;
  onClearForEveryone: () => void;
  contactName: string;
  isGuardian: boolean;
  canClearForEveryone?: boolean;
  everyoneRestrictionReason?: string;
  theme?: 'adult' | 'teen' | 'kid';
}

export const ClearChatModal: React.FC<ClearChatModalProps> = ({
  isOpen,
  onClose,
  onClearForMe,
  onClearForEveryone,
  contactName,
  isGuardian,
  canClearForEveryone = true,
  everyoneRestrictionReason,
  theme = 'adult'
}) => {
  if (!isOpen) return null;

  const isDark = theme !== 'kid';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl relative border ${
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

        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mb-3">
            <Eraser className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold mb-1">Limpiar conversación</h3>
          <p className={`text-xs mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            ¿Cómo deseas limpiar los mensajes del chat con <strong>{contactName}</strong>?
          </p>

          <div className="w-full space-y-2.5">
            <button
              onClick={() => { onClearForMe(); onClose(); }}
              className={`w-full py-3 px-4 rounded-xl flex items-center justify-between text-xs font-semibold border transition-all ${
                isDark
                  ? 'bg-slate-800 border-slate-700 hover:bg-slate-750 text-slate-200'
                  : 'bg-stone-50 border-stone-200 hover:bg-stone-100 text-stone-800'
              }`}
            >
              <div className="flex items-center gap-2.5 text-left">
                <UserMinus className="w-4 h-4 text-slate-400" />
                <div>
                  <div className="font-bold">Limpiar solo para mí</div>
                  <div className={`text-[10px] font-normal ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {contactName} aún conservará los mensajes
                  </div>
                </div>
              </div>
            </button>

            {canClearForEveryone ? (
              <button
                onClick={() => { onClearForEveryone(); onClose(); }}
                className="w-full py-3 px-4 rounded-xl flex items-center justify-between text-xs font-semibold border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all"
              >
                <div className="flex items-center gap-2.5 text-left">
                  <Trash2 className="w-4 h-4 text-red-400" />
                  <div>
                    <div className="font-bold">Limpiar para todos</div>
                    <div className="text-[10px] font-normal opacity-80">
                      Se vaciará el historial para ambos
                    </div>
                  </div>
                </div>
              </button>
            ) : (
              <div className={`w-full py-2.5 px-3.5 rounded-xl border flex items-center gap-2.5 ${
                isDark ? 'border-slate-800 bg-slate-800/40 text-slate-400' : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}>
                <Lock className="w-4 h-4 flex-shrink-0 text-amber-400" />
                <div className="text-left text-[11px] leading-tight">
                  <span className="font-bold block text-slate-300">Vaciar para todos restringido</span>
                  <span className="text-[10px] text-slate-500">
                    {everyoneRestrictionReason || 'En chats con menores (<18 años), solo su tutor legal registrado puede vaciar para todos.'}
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={onClose}
              className={`w-full py-2.5 rounded-xl text-xs font-medium transition-colors ${
                isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
