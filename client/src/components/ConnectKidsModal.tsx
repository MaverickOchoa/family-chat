import React, { useState, useEffect } from 'react';
import { X, Handshake, Shield, Sparkles, Check, UserCheck, AlertCircle } from 'lucide-react';
import { API_BASE } from '../config';

interface ConnectKidsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  targetGuardian: any;
  myChildren: any[];
  onSuccess?: () => void;
}

export const ConnectKidsModal: React.FC<ConnectKidsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  targetGuardian,
  myChildren,
  onSuccess
}) => {
  const [targetChildren, setTargetChildren] = useState<any[]>([]);
  const [selectedMyChildId, setSelectedMyChildId] = useState<string>('');
  const [selectedTargetChildId, setSelectedTargetChildId] = useState<string>('');
  const [environment, setEnvironment] = useState<string>('church');
  const [loading, setLoading] = useState(false);
  const [fetchingTargetKids, setFetchingTargetKids] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentSuccess, setSentSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen || !targetGuardian) return;

    setError(null);
    setSentSuccess(false);

    if (myChildren.length > 0) {
      setSelectedMyChildId(myChildren[0].id);
    }

    // Fetch target guardian's children
    setFetchingTargetKids(true);
    fetch(`${API_BASE}/api/guardian/children/${targetGuardian.id}`)
      .then((res) => res.json())
      .then((kids) => {
        if (Array.isArray(kids)) {
          setTargetChildren(kids);
          if (kids.length > 0) {
            setSelectedTargetChildId(kids[0].id);
          }
        }
      })
      .catch((err) => {
        console.error('Error fetching target children:', err);
      })
      .finally(() => {
        setFetchingTargetKids(false);
      });
  }, [isOpen, targetGuardian, myChildren]);

  if (!isOpen || !targetGuardian) return null;

  const handleSendHandshake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMyChildId || !selectedTargetChildId) {
      setError('Por favor selecciona a ambos menores para conectar.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/guardian/handshake/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromGuardianId: currentUser.id,
          toGuardianId: targetGuardian.id,
          fromChildId: selectedMyChildId,
          toChildId: selectedTargetChildId,
          environment
        })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Error al enviar solicitud');
      }

      setSentSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Error de conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-md rounded-3xl p-6 shadow-2xl bg-slate-900 border border-slate-800 text-white animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
              <Handshake className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Apretón de Manos entre Familias</h3>
              <p className="text-[11px] text-slate-400">Conectar hijos con @{targetGuardian.username}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {sentSuccess ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
              <Check className="w-7 h-7" />
            </div>
            <h4 className="font-bold text-lg text-white">¡Solicitud de Conexión Enviada!</h4>
            <p className="text-xs text-slate-300 max-w-xs mx-auto">
              Se ha notificado a @{targetGuardian.username}. Cuando acepte con su PIN de guardián, ambas niñas podrán hablar con cifrado E2EE y ambas madres tendrán supervisión espejo.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSendHandshake} className="py-4 space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* 1. Select My Child */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                1. ¿A cuál de tus hijos deseas conectar?
              </label>
              {myChildren.length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
                  Aún no tienes hijos registrados en tu cuenta familiar. Usa el botón "+ Agregar Hijo/a" en el panel.
                </div>
              ) : (
                <select
                  value={selectedMyChildId}
                  onChange={(e) => setSelectedMyChildId(e.target.value)}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-purple-500 font-medium"
                >
                  {myChildren.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.username} ({child.age} años - {child.role === 'kid' ? 'Niño/a' : 'Adolescente'})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* 2. Select Target Child */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                2. ¿Con cuál hijo/a de @{targetGuardian.username}?
              </label>
              {fetchingTargetKids ? (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 text-center animate-pulse">
                  Consultando hijos registrados de {targetGuardian.username}...
                </div>
              ) : targetChildren.length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-amber-400">
                  @{targetGuardian.username} aún no ha registrado hijos en su cuenta. Pídele que agregue a su hija/o desde su panel.
                </div>
              ) : (
                <select
                  value={selectedTargetChildId}
                  onChange={(e) => setSelectedTargetChildId(e.target.value)}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-purple-500 font-medium"
                >
                  {targetChildren.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.username} ({child.age} años - {child.role === 'kid' ? 'Niño/a' : 'Adolescente'})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* 3. Environment */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                3. Entorno de la relación
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setEnvironment('church')}
                  className={`p-2.5 rounded-xl border text-left font-medium transition-all ${
                    environment === 'church'
                      ? 'bg-purple-600/20 border-purple-500 text-white shadow-sm'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="block font-bold">⛪ Iglesia / Comunidad</span>
                  <span className="text-[10px] text-slate-400">Amigas de congregación</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEnvironment('family')}
                  className={`p-2.5 rounded-xl border text-left font-medium transition-all ${
                    environment === 'family'
                      ? 'bg-purple-600/20 border-purple-500 text-white shadow-sm'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="block font-bold">🏠 Familia / Amigos</span>
                  <span className="text-[10px] text-slate-400">Círculo de confianza</span>
                </button>
              </div>
            </div>

            {/* Protection Notice */}
            <div className="p-3 bg-purple-950/30 border border-purple-500/20 rounded-2xl flex items-start gap-2.5">
              <Shield className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-300 leading-relaxed">
                <strong>Protección Soberana de Menores:</strong> Ambas madres mantendrán acceso en <strong>Modo Espejo</strong> para supervisar los chats de menores de 10 años, garantizando un entorno 100% seguro y libre de riesgos.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || myChildren.length === 0 || targetChildren.length === 0}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg disabled:opacity-50 transition-transform active:scale-95"
              >
                {loading ? 'Enviando...' : '🤝 Conectar Hijos'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
