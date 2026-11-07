import React, { useState } from 'react';
import { X, UserPlus, Sparkles, Shield, Check, Copy, CheckCircle2 } from 'lucide-react';
import { API_BASE } from '../config';

interface AddChildModalProps {
  isOpen: boolean;
  onClose: () => void;
  guardianId: string;
  onChildCreated: () => void;
}

export const AddChildModal: React.FC<AddChildModalProps> = ({
  isOpen,
  onClose,
  guardianId,
  onChildCreated
}) => {
  const [childUsername, setChildUsername] = useState('');
  const [childAge, setChildAge] = useState(8);
  const [childPassword, setChildPassword] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(
    `https://api.dicebear.com/7.x/fun-emoji/svg?seed=Rocket`
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<any | null>(null);

  if (!isOpen) return null;

  const childAvatars = [
    `https://api.dicebear.com/7.x/fun-emoji/svg?seed=Rocket`,
    `https://api.dicebear.com/7.x/fun-emoji/svg?seed=Star`,
    `https://api.dicebear.com/7.x/fun-emoji/svg?seed=Lion`,
    `https://api.dicebear.com/7.x/fun-emoji/svg?seed=Dino`,
    `https://api.dicebear.com/7.x/fun-emoji/svg?seed=Cat`,
    `https://api.dicebear.com/7.x/fun-emoji/svg?seed=Panda`
  ];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!childUsername.trim()) {
      setError('Por favor escribe el nombre de usuario de tu hijo/a.');
      return;
    }
    if (!childPassword.trim()) {
      setError('Por favor define una clave sencilla de acceso para el menor.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/guardian/create-child`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guardianId,
          username: childUsername.trim(),
          password: childPassword.trim(),
          age: childAge,
          avatar: selectedAvatar
        })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Error al crear cuenta.');
      }

      setCreatedResult({
        username: childUsername.trim(),
        password: childPassword.trim(),
        age: childAge,
        role: childAge >= 10 ? 'teen' : 'kid',
        avatar: selectedAvatar
      });
      onChildCreated();
    } catch (err: any) {
      setError(err.message || 'Error de conexión.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setCreatedResult(null);
    setChildUsername('');
    setChildPassword('');
    setChildAge(8);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-md rounded-3xl p-6 sm:p-7 shadow-2xl bg-slate-900 border border-slate-800 text-white">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Agregar Hijo/a a la Familia</h3>
              <p className="text-[11px] text-slate-400">Vinculación instantánea a tu cuenta de tutor</p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {createdResult ? (
          /* Success Screen with Device Login Credentials */
          <div className="py-6 space-y-4 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-lg">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h4 className="font-black text-lg text-white">¡Cuenta de @{createdResult.username} Creada!</h4>
              <p className="text-xs text-slate-400 mt-1">
                Ya está vinculada bajo tu tutela. Para que ingrese desde su tablet o celular:
              </p>
            </div>

            <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 text-left space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Usuario:</span>
                <span className="font-mono font-bold text-white text-sm">@{createdResult.username}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Clave de acceso:</span>
                <span className="font-mono font-bold text-amber-400 text-sm">{createdResult.password}</span>
              </div>
              <div className="flex items-center justify-between text-xs border-t border-slate-800/80 pt-2">
                <span className="text-slate-400">Interfaz asignada:</span>
                <span className="font-semibold text-emerald-400 text-xs">
                  {createdResult.role === 'kid' ? '🌟 Modo Niño (<10) con Espejo' : '⚡ Modo Joven (10-17)'}
                </span>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg text-xs"
            >
              Entendido, volver a mi panel
            </button>
          </div>
        ) : (
          /* Child Creation Form */
          <form onSubmit={handleCreate} className="py-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Nombre de usuario para tu hijo/a
              </label>
              <input
                type="text"
                required
                value={childUsername}
                onChange={(e) => setChildUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="ej: mateo, leo, sofia"
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                <span>Edad: <strong>{childAge} años</strong></span>
                <span className="text-[10px] text-amber-400 font-semibold">
                  {childAge < 10 ? 'Modo Niño (<10 años) con vista espejo' : 'Modo Joven (10-17 años)'}
                </span>
              </label>
              <input
                type="range"
                min={4}
                max={17}
                value={childAge}
                onChange={(e) => setChildAge(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Contraseña sencilla o PIN para su dispositivo
              </label>
              <input
                type="text"
                required
                value={childPassword}
                onChange={(e) => setChildPassword(e.target.value)}
                placeholder="ej: 1234 o clave fácil"
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Para menores puedes usar una clave sencilla que recuerden fácilmente.
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Elige un avatar divertido:
              </label>
              <div className="grid grid-cols-6 gap-2">
                {childAvatars.map((av, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedAvatar(av)}
                    className={`p-1 rounded-xl border transition-all ${
                      selectedAvatar === av
                        ? 'border-amber-400 scale-105 bg-amber-400/20 shadow-md'
                        : 'border-slate-800 hover:border-slate-700 bg-slate-800/40'
                    }`}
                  >
                    <img src={av} alt="" className="w-full h-auto rounded-lg object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-red-400 text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 mt-2 active:scale-98"
            >
              {loading ? 'Creando cuenta...' : <><UserPlus className="w-4 h-4" /> Crear Cuenta del Hijo</>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
