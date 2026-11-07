import React, { useState, useRef } from 'react';
import { X, Camera, Upload, Check, Sparkles, User } from 'lucide-react';
import { API_BASE } from '../config';

interface AvatarEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  onAvatarUpdated: (newAvatarUrl: string) => void;
}

export const AvatarEditorModal: React.FC<AvatarEditorModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onAvatarUpdated
}) => {
  const [selectedPreview, setSelectedPreview] = useState<string | null>(currentUser?.avatar || null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Preset elegant / fun avatars
  const presetAvatars = currentUser.role === 'kid' ? [
    `https://api.dicebear.com/7.x/fun-emoji/svg?seed=Star1`,
    `https://api.dicebear.com/7.x/fun-emoji/svg?seed=Smile2`,
    `https://api.dicebear.com/7.x/fun-emoji/svg?seed=Rocket3`,
    `https://api.dicebear.com/7.x/fun-emoji/svg?seed=Cool4`,
    `https://api.dicebear.com/7.x/fun-emoji/svg?seed=Happy5`,
    `https://api.dicebear.com/7.x/fun-emoji/svg?seed=Joy6`
  ] : [
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentUser.username)}&backgroundColor=4f46e5`,
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentUser.username)}&backgroundColor=0284c7`,
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentUser.username)}&backgroundColor=7c3aed`,
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentUser.username)}&backgroundColor=059669`,
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentUser.username)}&backgroundColor=dc2626`,
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentUser.username)}&backgroundColor=d97706`
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 250;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          }
        } else {
          if (h > maxDim) {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          setSelectedPreview(dataUrl);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSave = async () => {
    if (!selectedPreview) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/users/${currentUser.id}/avatar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: selectedPreview })
      });
      const data = await res.json();
      if (data.success) {
        onAvatarUpdated(selectedPreview);
        onClose();
      } else {
        alert(data.error || 'Error al actualizar foto.');
      }
    } catch (e: any) {
      alert('Error de conexión al guardar foto.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-sm rounded-3xl p-6 shadow-2xl bg-slate-900 border border-slate-800 text-white">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Camera className="w-4 h-4 text-indigo-400" /> Foto de Perfil Familiar
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-5 flex flex-col items-center">
          {/* Main Avatar Preview */}
          <div className="relative group">
            <img
              src={selectedPreview || currentUser.avatar}
              alt="Avatar"
              className="w-24 h-24 rounded-full border-4 border-indigo-500/50 object-cover shadow-xl bg-slate-800"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-xs text-white transition-opacity font-semibold cursor-pointer"
            >
              <Upload className="w-5 h-5 mb-1" /> Cambiar
            </button>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" /> Subir foto desde tu dispositivo
          </button>
        </div>

        {/* Preset suggestions */}
        <div className="mb-5">
          <span className="text-[11px] font-semibold text-slate-400 block mb-2">O elige un estilo predeterminado:</span>
          <div className="grid grid-cols-6 gap-2">
            {presetAvatars.map((av, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedPreview(av)}
                className={`p-1 rounded-xl border transition-all ${
                  selectedPreview === av
                    ? 'border-indigo-500 scale-105 bg-indigo-500/20 shadow'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-800/40'
                }`}
              >
                <img src={av} alt="" className="w-full h-auto rounded-lg object-cover" />
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-1.5"
          >
            {saving ? 'Guardando...' : <><Check className="w-4 h-4" /> Guardar Foto</>}
          </button>
        </div>
      </div>
    </div>
  );
};
