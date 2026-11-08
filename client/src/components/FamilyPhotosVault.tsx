import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Trash2, 
  Download, 
  Lock, 
  Image as ImageIcon, 
  Folder, 
  Clock, 
  ShieldCheck, 
  X, 
  User, 
  Sparkles,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { DeleteOptionsModal } from './DeleteOptionsModal';

interface FamilyPhotosVaultProps {
  currentUser: any;
  contacts: any[];
  messages: any[];
  onBackToChat: () => void;
  onDeleteMessage: (msgId: string, mode: 'for_me' | 'for_everyone') => void;
  onDeleteChatPhotos: (contactId: string, mode: 'for_me' | 'for_everyone') => void;
  onRequestPinUnlock: (callback: () => void, title?: string, description?: string) => void;
}

export const FamilyPhotosVault: React.FC<FamilyPhotosVaultProps> = ({
  currentUser,
  contacts,
  messages,
  onBackToChat,
  onDeleteMessage,
  onDeleteChatPhotos,
  onRequestPinUnlock
}) => {
  const [activeTab, setActiveTab] = useState<'albums' | 'all' | 'vault'>('albums');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [activeLightboxPhoto, setActiveLightboxPhoto] = useState<any | null>(null);
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);
  const [deletePhotoTarget, setDeletePhotoTarget] = useState<any | null>(null);
  const [showClearAlbumModal, setShowClearAlbumModal] = useState<string | null>(null);

  // Extract general family photos (PUBLIC: Strictly excludes protected photos!)
  const publicPhotos = messages.filter((m) => m.type === 'image' && m.decryptedMediaUrl && !m.isProtected);

  // Photos grouped by contact (Strictly public photos only - never leak protected photos in albums)
  const getContactPhotos = (contactId: string) => {
    return publicPhotos.filter(
      (m) =>
        (m.fromUserId === currentUser.id && m.toUserId === contactId) ||
        (m.fromUserId === contactId && m.toUserId === currentUser.id)
    );
  };

  // Protected photos (CONFIDENTIAL: ONLY shown inside the PIN-unlocked Vault)
  const protectedPhotos = messages.filter((m) => m.type === 'image' && m.decryptedMediaUrl && m.isProtected);

  // Download photo to phone camera roll (opt-in explicit download)
  const handleDownload = (photoUrl: string, filename: string = 'familia-foto.jpg') => {
    const a = document.createElement('a');
    a.href = photoUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Open Vault with PIN check
  const handleOpenVaultTab = () => {
    if (isVaultUnlocked) {
      setActiveTab('vault');
    } else {
      onRequestPinUnlock(
        () => {
          setIsVaultUnlocked(true);
          setActiveTab('vault');
        },
        'Desbloquear Bóveda Protegida',
        'Ingresa el PIN de Guardián para consultar fotos confidenciales y documentos familiares.'
      );
    }
  };

  const selectedContact = contacts.find((c) => c.id === selectedContactId);
  const selectedAlbumPhotos = selectedContactId ? getContactPhotos(selectedContactId) : [];

  const targetContact = contacts.find(
    (c) =>
      deletePhotoTarget &&
      (c.id === (deletePhotoTarget.fromUserId === currentUser.id ? deletePhotoTarget.toUserId : deletePhotoTarget.fromUserId))
  );
  const targetIsMinor = targetContact && (
    targetContact.role === 'kid' ||
    targetContact.role === 'teen' ||
    (targetContact.age !== undefined && targetContact.age < 18)
  );
  const isLegalGuardianOfTarget = targetIsMinor && targetContact.guardianId === currentUser.id;
  const canDeleteForEveryone = !targetIsMinor || isLegalGuardianOfTarget;

  const albumContact = contacts.find((c) => c.id === showClearAlbumModal);
  const albumContactIsMinor = albumContact && (
    albumContact.role === 'kid' ||
    albumContact.role === 'teen' ||
    (albumContact.age !== undefined && albumContact.age < 18)
  );
  const isLegalGuardianOfAlbumContact = albumContactIsMinor && albumContact.guardianId === currentUser.id;
  const canClearAlbumForEveryone = !albumContactIsMinor || isLegalGuardianOfAlbumContact;

  return (
    <div className="flex flex-col h-full h-[100dvh] max-h-[100dvh] bg-slate-950 text-white font-sans select-none overflow-hidden">
      {/* Header */}
      <header className="p-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (selectedContactId) setSelectedContactId(null);
              else onBackToChat();
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-base tracking-tight text-white flex items-center gap-1.5">
                📸 Bóveda de Fotos Familiar
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Sandbox Estanco
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Tus fotos familiares protegidas sin contaminar Google Fotos ni tu carrete
            </p>
          </div>
        </div>

        <button
          onClick={onBackToChat}
          className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md flex items-center gap-1.5 transition-all"
        >
          💬 Volver al Chat
        </button>
      </header>

      {/* Navigation Sub-Tabs */}
      {!selectedContactId && (
        <div className="px-4 py-2.5 bg-slate-900/60 border-b border-slate-800 flex gap-2 flex-shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('albums')}
            className={`py-2 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'albums'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-800/80 text-slate-400 hover:text-white'
            }`}
          >
            <Folder className="w-4 h-4" /> Álbumes por Familiar ({contacts.length})
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`py-2 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-800/80 text-slate-400 hover:text-white'
            }`}
          >
            <ImageIcon className="w-4 h-4" /> Todas las Fotos ({allPhotos.length})
          </button>

          <button
            onClick={handleOpenVaultTab}
            className={`py-2 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'vault'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-slate-800/80 text-amber-400/90 hover:bg-slate-800 hover:text-amber-300'
            }`}
          >
            <Lock className="w-4 h-4" /> Bóveda Oculta PIN ({protectedPhotos.length})
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 bg-slate-950">
        {/* 1. VIEW: INSIDE A SPECIFIC CONTACT ALBUM */}
        {selectedContactId && selectedContact && (
          <div className="max-w-5xl mx-auto space-y-4">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-3">
                <img
                  src={selectedContact.avatar}
                  alt=""
                  className="w-12 h-12 rounded-full border border-slate-700 object-cover bg-slate-800 shadow"
                />
                <div>
                  <h2 className="font-bold text-base text-white">Fotos compartidas con {selectedContact.username}</h2>
                  <p className="text-xs text-slate-400">
                    {selectedAlbumPhotos.length} fotos guardadas en el sandbox cifrado
                  </p>
                </div>
              </div>

              {selectedAlbumPhotos.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowClearAlbumModal(selectedContact.id)}
                  className="py-2 px-3.5 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold flex items-center gap-1.5 transition-colors self-start sm:self-center"
                >
                  <Trash2 className="w-4 h-4" /> Vaciar fotos de este chat
                </button>
              )}
            </div>

            {selectedAlbumPhotos.length === 0 ? (
              <div className="p-16 text-center text-slate-500 space-y-2">
                <ImageIcon className="w-12 h-12 mx-auto text-slate-600 opacity-50" />
                <p className="text-sm font-semibold text-slate-400">No hay fotos en esta conversación aún.</p>
                <p className="text-xs">Las fotos que envíes o recibas con {selectedContact.username} se guardarán aquí automáticamente.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {selectedAlbumPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    onClick={() => setActiveLightboxPhoto(photo)}
                    className="group relative aspect-square rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 cursor-pointer shadow-md hover:border-indigo-500/50 transition-all hover:scale-[1.02]"
                  >
                    <img
                      src={photo.decryptedMediaUrl}
                      alt="Foto"
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2 text-[10px] text-slate-300">
                      <span>{new Date(photo.timestamp).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 2. VIEW: ALBUMS LIST */}
        {!selectedContactId && activeTab === 'albums' && (
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {contacts.map((contact) => {
                const photos = getContactPhotos(contact.id);
                const latestPhoto = photos[photos.length - 1];

                return (
                  <div
                    key={contact.id}
                    className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-lg hover:border-slate-700 transition-all flex flex-col justify-between"
                  >
                    <div
                      onClick={() => setSelectedContactId(contact.id)}
                      className="cursor-pointer space-y-3"
                    >
                      {/* Album Cover Thumbnail */}
                      <div className="w-full aspect-video rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center relative">
                        {latestPhoto?.decryptedMediaUrl ? (
                          <img
                            src={latestPhoto.decryptedMediaUrl}
                            alt="Cover"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center text-slate-600 gap-1">
                            <ImageIcon className="w-8 h-8 opacity-40" />
                            <span className="text-[11px]">Sin fotos aún</span>
                          </div>
                        )}
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur text-[10px] font-mono text-white">
                          {photos.length} fotos
                        </div>
                      </div>

                      {/* Contact Info */}
                      <div className="flex items-center gap-2.5">
                        <img
                          src={contact.avatar}
                          alt=""
                          className="w-9 h-9 rounded-full border border-slate-700 object-cover bg-slate-800"
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-sm text-white truncate">Álbum con {contact.username}</h3>
                          <span className="text-[10px] text-slate-400 capitalize">{contact.role}</span>
                        </div>
                      </div>
                    </div>

                    {/* Album Actions */}
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <button
                        onClick={() => setSelectedContactId(contact.id)}
                        className="text-indigo-400 hover:text-indigo-300 font-bold"
                      >
                        Ver álbum →
                      </button>
                      {photos.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowClearAlbumModal(contact.id)}
                          className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                          title="Vaciar fotos de este chat"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. VIEW: ALL PHOTOS TIMELINE (Public only) */}
        {!selectedContactId && activeTab === 'all' && (
          <div className="max-w-5xl mx-auto space-y-4">
            {publicPhotos.length === 0 ? (
              <div className="p-16 text-center text-slate-500 space-y-2">
                <ImageIcon className="w-12 h-12 mx-auto text-slate-600 opacity-50" />
                <p className="text-sm font-semibold text-slate-400">Aún no se han enviado fotos públicas en la plataforma.</p>
                <p className="text-xs">Toma fotos o adjúntalas en tus chats y aparecerán aquí ordenadas.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {publicPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    onClick={() => setActiveLightboxPhoto(photo)}
                    className="group relative aspect-square rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 cursor-pointer shadow-md hover:border-indigo-500/50 transition-all hover:scale-[1.02]"
                  >
                    <img
                      src={photo.decryptedMediaUrl}
                      alt="Foto familiar"
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2 text-[10px] text-slate-300">
                      <span>{new Date(photo.timestamp).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. VIEW: PROTECTED VAULT (WITH PIN) */}
        {!selectedContactId && activeTab === 'vault' && (
          <div className="max-w-5xl mx-auto space-y-4">
            <div className="p-4 bg-amber-950/20 border border-amber-800/40 rounded-3xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Bóveda Oculta Desbloqueada</h3>
                  <p className="text-xs text-amber-300/80">
                    Documentos y fotos marcadas con PIN de Guardián ({protectedPhotos.length} fotos)
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsVaultUnlocked(false);
                  setActiveTab('albums');
                }}
                className="text-xs px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Bloquear Bóveda
              </button>
            </div>

            {protectedPhotos.length === 0 ? (
              <div className="p-16 text-center text-slate-500 space-y-2">
                <Lock className="w-12 h-12 mx-auto text-amber-500/40" />
                <p className="text-sm font-semibold text-slate-400">No hay fotos protegidas en la bóveda.</p>
                <p className="text-xs">
                  Al enviar una foto sensible o documento, activa el botón <strong>"Proteger con PIN"</strong>.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {protectedPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    onClick={() => setActiveLightboxPhoto(photo)}
                    className="group relative aspect-square rounded-2xl overflow-hidden bg-slate-900 border border-amber-500/30 cursor-pointer shadow-md hover:border-amber-400 transition-all hover:scale-[1.02]"
                  >
                    <img
                      src={photo.decryptedMediaUrl}
                      alt="Foto protegida"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2 p-1 bg-amber-500 text-slate-950 rounded-lg shadow">
                      <Lock className="w-3 h-3" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* FULLSCREEN LIGHTBOX MODAL */}
      {activeLightboxPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center">
            {/* Top Bar */}
            <div className="w-full flex items-center justify-between pb-3 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                {activeLightboxPhoto.isProtected && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Protegida
                  </span>
                )}
                <span>{new Date(activeLightboxPhoto.timestamp).toLocaleString()}</span>
              </div>
              <button
                onClick={() => setActiveLightboxPhoto(null)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Photo Display */}
            <div className="relative w-full max-h-[70vh] flex items-center justify-center overflow-hidden rounded-2xl bg-black">
              <img
                src={activeLightboxPhoto.decryptedMediaUrl}
                alt="Foto"
                className="max-h-[70vh] w-auto max-w-full object-contain rounded-xl shadow-2xl"
              />
            </div>

            {/* Bottom Actions Bar */}
            <div className="w-full pt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleDownload(activeLightboxPhoto.decryptedMediaUrl, `familia_${activeLightboxPhoto.id}.jpg`)}
                className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition-transform active:scale-95"
              >
                <Download className="w-4 h-4" /> Guardar en mi Carrete
              </button>

              <button
                type="button"
                onClick={() => {
                  setDeletePhotoTarget(activeLightboxPhoto);
                  setActiveLightboxPhoto(null);
                }}
                className="py-2.5 px-4 rounded-xl border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs flex items-center gap-2 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Eliminar Foto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Photo Modal */}
      <DeleteOptionsModal
        isOpen={!!deletePhotoTarget}
        onClose={() => setDeletePhotoTarget(null)}
        onDeleteForMe={() => deletePhotoTarget && onDeleteMessage(deletePhotoTarget.id, 'for_me')}
        onDeleteForEveryone={() => deletePhotoTarget && onDeleteMessage(deletePhotoTarget.id, 'for_everyone')}
        isMine={deletePhotoTarget?.fromUserId === currentUser.id}
        isGuardian={currentUser.role === 'guardian'}
        canDeleteForEveryone={canDeleteForEveryone}
        everyoneRestrictionReason={
          !canDeleteForEveryone
            ? 'Solo el tutor legal puede eliminar contenido para todos en chats con menores.'
            : undefined
        }
        theme="adult"
      />

      {/* Clear Entire Album Modal */}
      {showClearAlbumModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl p-6 shadow-2xl bg-slate-900 border border-slate-800 text-white text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base mb-1">¿Vaciar todas las fotos de este chat?</h3>
            <p className="text-xs text-slate-400 mb-6">
              Esta acción borrará todas las imágenes compartidas en esta conversación para liberar espacio. Los mensajes de texto se conservarán.
            </p>

            <div className="space-y-2.5">
              <button
                onClick={() => {
                  onDeleteChatPhotos(showClearAlbumModal, 'for_me');
                  setShowClearAlbumModal(null);
                }}
                className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold border border-slate-700"
              >
                Borrar fotos solo para mí
              </button>

              <button
                disabled={!canClearAlbumForEveryone}
                onClick={() => {
                  if (!canClearAlbumForEveryone) return;
                  onDeleteChatPhotos(showClearAlbumModal, 'for_everyone');
                  setShowClearAlbumModal(null);
                }}
                className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-all ${
                  canClearAlbumForEveryone
                    ? 'bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400'
                    : 'bg-slate-800/40 border border-slate-700/40 text-slate-500 cursor-not-allowed opacity-60'
                }`}
              >
                Borrar fotos para todos
                {!canClearAlbumForEveryone && (
                  <span className="block text-[10px] font-normal text-amber-400/90 mt-0.5">
                    🔒 Solo el tutor legal puede eliminar para todos
                  </span>
                )}
              </button>

              <button
                onClick={() => setShowClearAlbumModal(null)}
                className="w-full py-2.5 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
