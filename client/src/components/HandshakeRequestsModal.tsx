import React, { useState } from 'react';
import { X, Handshake, Shield, Check, Lock, AlertCircle } from 'lucide-react';
import { API_BASE } from '../config';

interface HandshakeRequestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  handshakes: any[];
  onRefresh: () => void;
}

export const HandshakeRequestsModal: React.FC<HandshakeRequestsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  handshakes,
  onRefresh
}) => {
  const [pinInputs, setPinInputs] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const pendingRequests = handshakes.filter(
    (h) => h.toGuardianId === currentUser.id && h.status === 'pending'
  );

  const handleRespond = async (handshakeId: string, response: 'accept' | 'reject') => {
    const pin = pinInputs[handshakeId] || '1234';
    if (response === 'accept' && !pin) {
      setError('Debes ingresar tu PIN de guardián para autorizar.');
      return;
    }

    setLoadingId(handshakeId);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/guardian/handshake/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handshakeId,
          guardianId: currentUser.id,
          response,
          guardianPin: pin
        })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Error al procesar solicitud');
      }

      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Error al procesar la solicitud.');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-md rounded-3xl p-6 shadow-2xl bg-slate-900 border border-slate-800 text-white animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
              <Handshake className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Solicitudes de Conexión</h3>
              <p className="text-[11px] text-slate-400">Apretón de manos entre familias</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-4 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {pendingRequests.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 space-y-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-800/80 flex items-center justify-center text-slate-500">
                <Check className="w-6 h-6" />
              </div>
              <p className="font-semibold text-white">No tienes solicitudes pendientes</p>
              <p className="text-slate-500 text-[11px]">
                Cuando otra madre o guardián desee conectar a sus hijos con los tuyos, aparecerá aquí.
              </p>
            </div>
          ) : (
            pendingRequests.map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-2xl bg-slate-950/70 border border-purple-500/30 space-y-3 shadow-lg"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-purple-300 flex items-center gap-1.5">
                    <Handshake className="w-4 h-4 text-purple-400" /> @{req.fromGuardianName}
                  </span>
                  <span className="text-[10px] bg-purple-950 px-2 py-0.5 rounded-full text-purple-300 border border-purple-800/60 font-medium">
                    {req.environment === 'church' ? '⛪ Iglesia / Comunidad' : '🏠 Familia / Amigos'}
                  </span>
                </div>

                <p className="text-xs text-slate-300">
                  Solicita conectar a su hija/o <strong>"{req.fromChildName}"</strong> con tu hija/o <strong>"{req.toChildName}"</strong>.
                </p>

                <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="PIN de Guardián (1234)"
                    value={pinInputs[req.id] || ''}
                    onChange={(e) =>
                      setPinInputs((prev) => ({ ...prev, [req.id]: e.target.value }))
                    }
                    className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none font-mono"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    disabled={loadingId === req.id}
                    onClick={() => handleRespond(req.id, 'reject')}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-semibold transition-colors"
                  >
                    Rechazar
                  </button>
                  <button
                    type="button"
                    disabled={loadingId === req.id}
                    onClick={() => handleRespond(req.id, 'accept')}
                    className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-transform active:scale-95 shadow-md flex items-center justify-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {loadingId === req.id ? 'Aprobando...' : 'Aprobar Conexión'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
