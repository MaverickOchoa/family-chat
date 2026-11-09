import React, { useState, useEffect } from 'react';
import { 
  X, 
  Settings, 
  Download, 
  Bell, 
  BellRing, 
  Shield, 
  Key, 
  Check, 
  Smartphone, 
  Share2, 
  Layers, 
  Home, 
  Users, 
  Briefcase,
  Copy,
  LogOut,
  Sparkles,
  Lock,
  Trash2,
  Plus
} from 'lucide-react';
import { API_BASE } from '../config';
import { triggerDeviceNotification } from '../utils/notifications';

interface CustomEnvironment {
  id: string;
  name: string;
  desc: string;
  isFixed?: boolean;
}

const DEFAULT_ENVIRONMENTS: CustomEnvironment[] = [
  { id: 'all', name: '🌐 Todos los Entornos', desc: 'Ver todos tus contactos y chats reunidos', isFixed: true },
  { id: 'family', name: '🏠 Familia', desc: 'Núcleo familiar, fotos protegidas y supervisión (Fijo)', isFixed: true },
  { id: 'church', name: '⛪ Comunidad / Iglesia', desc: 'Grupos, actividades y amistades compartidas' },
  { id: 'work', name: '💼 Trabajo / Proyectos', desc: 'Documentos laborales y comunicación profesional' }
];

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  currentEnvironment: string;
  onSelectEnvironment: (env: string) => void;
  onLogout: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  currentEnvironment,
  onSelectEnvironment,
  onLogout
}) => {
  const [notificationStatus, setNotificationStatus] = useState<NotificationPermission>('default');
  const [copiedKey, setCopiedKey] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  // Environments State (Hooks declared unconditionally at the top)
  const [environments, setEnvironments] = useState<CustomEnvironment[]>(() => {
    try {
      const saved = localStorage.getItem('family_custom_environments');
      if (saved) {
        const parsed = JSON.parse(saved);
        const hasAll = parsed.some((e: any) => e.id === 'all');
        const hasFamily = parsed.some((e: any) => e.id === 'family');
        let merged = [...parsed];
        if (!hasAll) merged.unshift(DEFAULT_ENVIRONMENTS[0]);
        if (!hasFamily) merged.splice(1, 0, DEFAULT_ENVIRONMENTS[1]);
        return merged;
      }
    } catch (e) {}
    return DEFAULT_ENVIRONMENTS;
  });

  const [newEnvName, setNewEnvName] = useState('');
  const [showAddEnv, setShowAddEnv] = useState(false);

  // Guardian PIN Change State
  const [showPinChange, setShowPinChange] = useState(false);
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinChangeMsg, setPinChangeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinChangeMsg(null);
    const savedPin = localStorage.getItem('family_guardian_pin') || '1234';
    if (currentPinInput !== savedPin) {
      setPinChangeMsg({ type: 'error', text: 'El PIN actual no es correcto.' });
      return;
    }
    if (!/^\d{4,6}$/.test(newPinInput)) {
      setPinChangeMsg({ type: 'error', text: 'El nuevo PIN debe ser de 4 a 6 números.' });
      return;
    }
    if (newPinInput !== confirmPinInput) {
      setPinChangeMsg({ type: 'error', text: 'La confirmación del nuevo PIN no coincide.' });
      return;
    }

    localStorage.setItem('family_guardian_pin', newPinInput);
    try {
      await fetch(`${API_BASE}/api/guardian/change-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guardianId: currentUser.id,
          currentPin: currentPinInput,
          newPin: newPinInput
        })
      });
    } catch (e) {}

    setPinChangeMsg({ type: 'success', text: '¡PIN de Guardián actualizado exitosamente!' });
    setCurrentPinInput('');
    setNewPinInput('');
    setConfirmPinInput('');
  };

  useEffect(() => {
    // Check notification permission
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationStatus(Notification.permission);
    }

    // Check standalone mode (PWA installed)
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    setIsStandalone(!!isStandaloneMode);

    // Check iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    // Listen for PWA install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  if (!isOpen) return null;

  const handleRequestNotifications = async () => {
    if (!('Notification' in window)) {
      alert('Tu navegador no soporta notificaciones de sistema.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationStatus(permission);
      if (permission === 'granted') {
        triggerDeviceNotification('🔔 FamilyChat Conectado', {
          body: '¡Notificaciones familiares activas! Recibirás avisos de nuevos mensajes y fotos.',
          icon: '/favicon.svg'
        });
      }
    } catch (e) {
      console.error('Error requesting notifications:', e);
    }
  };

  const handleSendTestNotification = () => {
    if (Notification.permission === 'granted') {
      triggerDeviceNotification('👨‍👩‍👧‍👦 Mensaje Familiar de Prueba', {
        body: 'El canal cifrado de notificaciones funciona a la perfección.',
        icon: '/favicon.svg'
      });
    }
  };

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsStandalone(true);
        setDeferredPrompt(null);
      }
    }
  };

  const handleCopyKey = () => {
    if (currentUser?.publicKey) {
      navigator.clipboard.writeText(currentUser.publicKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };



  const handleAddEnvironment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEnvName.trim()) return;
    const newId = `env_${Date.now()}`;
    const updated = [
      ...environments,
      {
        id: newId,
        name: `🏷️ ${newEnvName.trim()}`,
        desc: 'Entorno personalizado de contactos'
      }
    ];
    setEnvironments(updated);
    localStorage.setItem('family_custom_environments', JSON.stringify(updated));
    setNewEnvName('');
    setShowAddEnv(false);
  };

  const handleDeleteEnvironment = (envId: string) => {
    if (envId === 'all' || envId === 'family') return;
    const updated = environments.filter((e) => e.id !== envId);
    setEnvironments(updated);
    localStorage.setItem('family_custom_environments', JSON.stringify(updated));
    if (currentEnvironment === envId) {
      onSelectEnvironment('family');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-md rounded-3xl p-6 shadow-2xl bg-slate-900 border border-slate-800 text-white max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Ajustes y Dispositivo</h3>
              <p className="text-[11px] text-slate-400">Configuración soberana del usuario</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-4 space-y-5">
          {/* 1. SECTOR: INSTALAR APP */}
          <div className="p-4 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
              <Smartphone className="w-4 h-4" /> App en tu Celular
            </div>

            {isStandalone ? (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2 font-semibold">
                <Check className="w-4 h-4" /> La app ya está instalada en tu pantalla de inicio
              </div>
            ) : deferredPrompt ? (
              <button
                type="button"
                onClick={handleInstallPWA}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"
              >
                <Download className="w-4 h-4" /> Instalar App en este Celular
              </button>
            ) : isIOS ? (
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs space-y-2">
                <span className="font-semibold text-white block">Para instalar en tu iPhone / iPad:</span>
                <ol className="list-decimal list-inside text-slate-300 space-y-1 text-[11px]">
                  <li>Toca el botón <strong>Compartir</strong> <Share2 className="w-3 h-3 inline text-indigo-400" /> en Safari.</li>
                  <li>Baja y selecciona <strong>"Agregar a pantalla de inicio"</strong> (+).</li>
                  <li>Se creará el icono de FamilyChat como app nativa.</li>
                </ol>
              </div>
            ) : (
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400 flex items-center justify-between">
                <span>Acceso directo instalado o disponible en el menú de tu navegador.</span>
                <span className="text-[10px] text-indigo-400 font-mono">PWA Lista</span>
              </div>
            )}
          </div>

          {/* 2. SECTOR: NOTIFICACIONES */}
          <div className="p-4 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                <Bell className="w-4 h-4" /> Permisos de Notificaciones
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                notificationStatus === 'granted'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : notificationStatus === 'denied'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                {notificationStatus === 'granted' ? 'ACTIVAS' : notificationStatus === 'denied' ? 'BLOQUEADAS' : 'PENDIENTE'}
              </span>
            </div>

            {notificationStatus !== 'granted' ? (
              <button
                type="button"
                onClick={handleRequestNotifications}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <BellRing className="w-4 h-4" /> Dar Permiso de Notificaciones
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSendTestNotification}
                className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <Bell className="w-3.5 h-3.5 text-emerald-400" /> Probar Notificación de Sonido/Vibración
              </button>
            )}
          </div>

          {/* 3. SECTOR: ENTORNO ACTIVO */}
          <div className="p-4 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
              <div className="flex items-center gap-2 text-indigo-400">
                <Layers className="w-4 h-4" /> Entornos Compartimentados
              </div>
              <button
                type="button"
                onClick={() => setShowAddEnv(!showAddEnv)}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold capitalize"
              >
                <Plus className="w-3.5 h-3.5" /> Nuevo entorno
              </button>
            </div>

            {/* Form to add custom environment */}
            {showAddEnv && (
              <form onSubmit={handleAddEnvironment} className="p-3 bg-slate-900 border border-indigo-500/30 rounded-xl space-y-2">
                <span className="text-xs font-bold text-white block">Crear nuevo entorno:</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newEnvName}
                    onChange={(e) => setNewEnvName(e.target.value)}
                    placeholder="Ej. Colegio, Scouts, Amigos..."
                    className="flex-1 py-1.5 px-3 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={!newEnvName.trim()}
                    className="py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs shadow"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddEnv(false)}
                    className="py-1.5 px-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2">
              {environments.map((env) => (
                <div
                  key={env.id}
                  className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all ${
                    currentEnvironment === env.id
                      ? 'border-indigo-500 bg-indigo-500/20 text-white shadow-md'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectEnvironment(env.id)}
                    className="flex-1 text-left min-w-0 pr-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs truncate">{env.name}</span>
                      {currentEnvironment === env.id && (
                        <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 flex-shrink-0">
                          <Check className="w-3 h-3" /> Activo
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">{env.desc}</p>
                  </button>

                  {!env.isFixed && (
                    <button
                      type="button"
                      onClick={() => handleDeleteEnvironment(env.id)}
                      className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors flex-shrink-0"
                      title="Eliminar este entorno"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 4. SECTOR: CRIPTOGRAFÍA & SESIÓN */}
          <div className="p-4 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-2.5 text-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span>Usuario Activo:</span>
              <strong className="text-white font-mono">@{currentUser.username}</strong>
            </div>

            {currentUser.email && (
              <div className="flex items-center justify-between text-slate-400">
                <span>Correo Vinculado:</span>
                <span className="text-slate-300 font-mono text-[11px]">{currentUser.email}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-slate-400">
              <span>Rol de Cuenta:</span>
              <span className="capitalize font-semibold text-indigo-400">{currentUser.role}</span>
            </div>

            <div className="flex items-center justify-between text-slate-400 pt-2 border-t border-slate-800">
              <span className="flex items-center gap-1">
                <Key className="w-3 h-3 text-indigo-400" /> Llave Pública E2EE:
              </span>
              <button
                type="button"
                onClick={handleCopyKey}
                className="text-[10px] font-mono text-indigo-400 hover:text-white flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded border border-slate-800"
              >
                {copiedKey ? '¡Copiada!' : 'Copiar Llave'}
              </button>
            </div>
          </div>

          {/* 5. SECTOR: SEGURIDAD & PIN DE GUARDIÁN */}
          {currentUser.role === 'guardian' && (
            <div className="p-4 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                  <Lock className="w-4 h-4" /> PIN de Seguridad de Guardián
                </div>
                <button
                  type="button"
                  onClick={() => setShowPinChange(!showPinChange)}
                  className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300"
                >
                  {showPinChange ? 'Ocultar' : 'Cambiar PIN'}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Este PIN de 4 dígitos protege la <strong>Bóveda Oculta</strong>, autoriza eliminar fotos/chats y vincula a los niños.
              </p>

              {showPinChange && (
                <form onSubmit={handleChangePin} className="space-y-2 pt-2 border-t border-slate-800/80">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">PIN Actual (Por defecto: 1234):</label>
                    <input
                      type="password"
                      maxLength={6}
                      required
                      value={currentPinInput}
                      onChange={(e) => setCurrentPinInput(e.target.value)}
                      placeholder="••••"
                      className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-center text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Nuevo PIN (4-6 núm):</label>
                      <input
                        type="password"
                        maxLength={6}
                        required
                        value={newPinInput}
                        onChange={(e) => setNewPinInput(e.target.value)}
                        placeholder="••••"
                        className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-center text-sm focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Confirmar Nuevo:</label>
                      <input
                        type="password"
                        maxLength={6}
                        required
                        value={confirmPinInput}
                        onChange={(e) => setConfirmPinInput(e.target.value)}
                        placeholder="••••"
                        className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-center text-sm focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {pinChangeMsg && (
                    <div className={`p-2 rounded-xl text-xs font-semibold text-center ${
                      pinChangeMsg.type === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}>
                      {pinChangeMsg.text}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md transition-colors mt-1"
                  >
                    Guardar Nuevo PIN
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Logout Button */}
          <button
            type="button"
            onClick={onLogout}
            className="w-full py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Cerrar Sesión en este Dispositivo
          </button>
        </div>
      </div>
    </div>
  );
};
