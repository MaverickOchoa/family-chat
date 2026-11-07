import React, { useState } from 'react';
import { QrCode, Copy, Check, X, UserPlus, ShieldCheck } from 'lucide-react';
import { API_BASE } from '../config';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  isGuardian: boolean;
  childrenList: Array<{ id: string; username: string }>;
  onInvitationAccepted: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({
  isOpen,
  onClose,
  currentUserId,
  isGuardian,
  childrenList,
  onInvitationAccepted
}) => {
  const [mode, setMode] = useState<'create' | 'enter'>('create');
  const [selectedChildId, setSelectedChildId] = useState<string>(childrenList[0]?.id || '');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; error: boolean } | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/invitations/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId: currentUserId,
          targetChildId: isGuardian && selectedChildId ? selectedChildId : undefined,
          targetRole: 'guardian'
        })
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedCode(data.invitation.token);
      } else {
        setStatusMsg({ text: data.error, error: true });
      }
    } catch (e: any) {
      setStatusMsg({ text: 'Error conectando al servidor.', error: true });
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/invitations/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: inputCode.trim(),
          recipientUserId: currentUserId
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ text: `¡Conexión establecida con ${data.connectedUser.username}!`, error: false });
        setInputCode('');
        setTimeout(() => {
          onInvitationAccepted();
          onClose();
        }, 1200);
      } else {
        setStatusMsg({ text: data.error, error: true });
      }
    } catch (e: any) {
      setStatusMsg({ text: 'Error al validar el código.', error: true });
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tabs */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl mb-6">
          <button
            onClick={() => { setMode('create'); setStatusMsg(null); }}
            className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all ${
              mode === 'create'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Invitar Familiar
          </button>
          <button
            onClick={() => { setMode('enter'); setStatusMsg(null); }}
            className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all ${
              mode === 'enter'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Tengo un Código
          </button>
        </div>

        {mode === 'create' ? (
          <div>
            <div className="flex items-center gap-2 mb-3 text-indigo-600 dark:text-indigo-400">
              <ShieldCheck className="w-5 h-5" />
              <h4 className="font-bold text-slate-900 dark:text-white text-base">
                {isGuardian ? 'Generar Invitación Segura' : 'Invitar a mi contacto'}
              </h4>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Por seguridad infantil, nadie puede escribirle a un menor sin un código exclusivo aprobado por ti.
            </p>

            {isGuardian && childrenList.length > 0 && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ¿Con cuál de tus hijos/sobrinos conectará?
                </label>
                <select
                  value={selectedChildId}
                  onChange={(e) => setSelectedChildId(e.target.value)}
                  className="w-full py-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value="">(Conectar conmigo directamente)</option>
                  {childrenList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.username}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!generatedCode ? (
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
              >
                <UserPlus className="w-5 h-5" />
                {loading ? 'Generando...' : 'Crear Código de Invitación'}
              </button>
            ) : (
              <div className="flex flex-col items-center p-4 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-2xl text-center">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-2">
                  <QrCode className="w-7 h-7" />
                </div>
                <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider mb-1">
                  Código de un solo uso
                </span>
                <span className="text-3xl font-mono font-black tracking-widest text-slate-900 dark:text-white my-2">
                  {generatedCode}
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  Pásale este código a la abuelita o familiar para que lo ingrese en su app. Válido por 24 horas.
                </p>
                <button
                  onClick={copyCode}
                  className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs flex items-center gap-1.5 transition-all"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? '¡Copiado!' : 'Copiar Código'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleAccept}>
            <h4 className="font-bold text-slate-900 dark:text-white text-base mb-1">Ingresar Código de Invitación</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Pega el código de 8 caracteres que te compartió el papá o la mamá.
            </p>

            <input
              type="text"
              placeholder="EJ: 8F2A9C1X"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              className="w-full text-center text-2xl tracking-[0.3em] font-mono py-3 px-4 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 mb-4"
            />

            {statusMsg && (
              <div className={`p-2.5 rounded-xl text-xs font-medium mb-4 ${
                statusMsg.error ? 'bg-red-50 text-red-600 dark:bg-red-950/40' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40'
              }`}>
                {statusMsg.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !inputCode.trim()}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-all shadow-md disabled:opacity-50"
            >
              {loading ? 'Validando...' : 'Conectar y Comenzar Chat'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
