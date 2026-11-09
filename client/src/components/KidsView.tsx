import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Play, Pause, Smile, Sparkles, Send, Trash2, Edit3, Eraser, Image as ImageIcon, Lock, Camera, Settings } from 'lucide-react';
import { AudioRecorder } from './AudioRecorder';
import { PhotoSender } from './PhotoSender';
import { DeleteOptionsModal } from './DeleteOptionsModal';
import { EditMessageModal } from './EditMessageModal';
import { ClearChatModal } from './ClearChatModal';
import { AvatarEditorModal } from './AvatarEditorModal';
import { FullscreenMediaModal } from './FullscreenMediaModal';

interface KidsViewProps {
  currentUser: any;
  contacts: any[];
  activeContact: any;
  onSelectContact: (contact: any) => void;
  onBackToContacts: () => void;
  messages: any[];
  onSendMessage: (text: string) => void;
  onSendAudio: (blob: Blob, duration: number) => void;
  onSendPhoto: (blob: Blob, isProtected?: boolean) => void;
  onDeleteMessage: (msgId: string, mode: 'for_me' | 'for_everyone') => void;
  onEditMessage: (msgId: string, newText: string) => void;
  onClearChat: (contactId: string, mode: 'for_me' | 'for_everyone') => void;
  onLogout: () => void;
  onOpenPhotosVault: () => void;
  onOpenSettings?: () => void;
  unlockedProtectedPhotos?: string[];
  onUnlockProtectedPhoto?: (msgId: string) => void;
  onUserUpdated?: (user: any) => void;
  onlineUsers?: Set<string>;
}

export const KidsView: React.FC<KidsViewProps> = ({
  currentUser,
  contacts,
  activeContact,
  onSelectContact,
  onBackToContacts,
  messages,
  onSendMessage,
  onSendAudio,
  onSendPhoto,
  onDeleteMessage,
  onEditMessage,
  onClearChat,
  onLogout,
  onOpenPhotosVault,
  onOpenSettings,
  unlockedProtectedPhotos,
  onUnlockProtectedPhoto,
  onUserUpdated,
  onlineUsers = new Set()
}) => {
  const [inputText, setInputText] = useState('');
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [deleteTargetMsg, setDeleteTargetMsg] = useState<any | null>(null);
  const [editTargetMsg, setEditTargetMsg] = useState<any | null>(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [fullscreenMedia, setFullscreenMedia] = useState<{ url: string; title: string; subtitle?: string } | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleAudio = (msgId: string, url: string) => {
    if (playingAudioId === msgId) {
      audioPlayerRef.current?.pause();
      setPlayingAudioId(null);
      return;
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }
    try {
      const audio = new Audio(url);
      audioPlayerRef.current = audio;
      setPlayingAudioId(msgId);
      audio.play().catch((err) => {
        console.warn('Audio play error:', err);
        setPlayingAudioId(null);
      });
      audio.onended = () => setPlayingAudioId(null);
      audio.onerror = () => setPlayingAudioId(null);
    } catch (e) {
      console.error('Audio creation error:', e);
      setPlayingAudioId(null);
    }
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  return (
    <div className="flex flex-col h-full h-[100dvh] max-h-[100dvh] bg-amber-50 text-amber-950 font-sans select-none overflow-hidden">
      {/* Top Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-3.5 bg-amber-300/90 backdrop-blur border-b-2 sm:border-b-4 border-amber-400 shadow-sm z-10">
        <div className="flex items-center gap-2 sm:gap-3">
          {activeContact && (
            <button
              onClick={onBackToContacts}
              className="p-1.5 sm:p-2 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-900 shadow-sm"
            >
              <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          )}
          <div className="flex items-center gap-2 sm:gap-3">
            <div
              onClick={() => {
                if (activeContact) {
                  setFullscreenMedia({
                    url: activeContact.avatar,
                    title: activeContact.username,
                    subtitle: 'Foto de perfil'
                  });
                } else {
                  setShowAvatarModal(true);
                }
              }}
              className="relative cursor-pointer group"
              title={!activeContact ? 'Cambiar tu avatar divertido' : 'Ver foto en grande'}
            >
              <img
                src={activeContact ? activeContact.avatar : currentUser.avatar}
                alt="Avatar"
                className="w-9 h-9 sm:w-11 sm:h-11 rounded-full border-2 border-white shadow-sm bg-white object-cover group-hover:scale-105 transition-transform"
              />
              {!activeContact && (
                <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                  <Camera className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-amber-900 tracking-wide truncate max-w-[160px] sm:max-w-xs">
                {activeContact ? activeContact.username : `¡Hola, ${currentUser.username}! 🌟`}
              </h1>
              <span className="text-[10px] sm:text-xs font-bold text-amber-700 bg-amber-200/80 px-2 py-0.5 rounded-full inline-block">
                {activeContact ? 'Familiar Conectado' : 'Tu espacio seguro (Toca foto para cambiar)'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenPhotosVault}
            className="text-xs font-bold bg-amber-200 hover:bg-amber-100 text-amber-950 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-transform active:scale-95 shadow-sm"
            title="Bóveda de Fotos Familiar"
          >
            <ImageIcon className="w-4 h-4 text-amber-800" />
            <span className="hidden sm:inline">Fotos</span>
          </button>

          {activeContact && (
            <button
              onClick={() => setShowClearModal(true)}
              className="text-xs font-bold bg-amber-200 hover:bg-amber-300 text-amber-900 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl flex items-center gap-1 transition-colors"
              title="Limpiar conversación (Requiere PIN)"
            >
              <Eraser className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Limpiar chat</span>
            </button>
          )}

          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="p-1.5 sm:p-2 rounded-xl bg-amber-200 hover:bg-amber-100 text-amber-950 transition-colors shadow-sm"
              title="Ajustes"
            >
              <Settings className="w-4 h-4 text-amber-800" />
            </button>
          )}

          <button
            onClick={onLogout}
            className="text-xs font-bold bg-amber-200 hover:bg-amber-300 text-amber-800 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl shadow-sm"
          >
            Salir
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 flex overflow-hidden">
        {/* If no contact is selected, show giant colorful family contact cards */}
        {!activeContact ? (
          <div className="flex-1 p-6 overflow-y-auto max-w-2xl mx-auto w-full">
            <div className="text-center my-4">
              <h2 className="text-2xl font-black text-amber-900 mb-1 flex items-center justify-center gap-2">
                ¿Con quién quieres hablar hoy? <Sparkles className="w-6 h-6 text-amber-500 fill-amber-400" />
              </h2>
              <p className="text-sm font-semibold text-amber-700">Toca a la persona para abrir tu chat:</p>
            </div>

            {contacts.length === 0 ? (
              <div className="p-8 bg-white/70 border-2 border-amber-200 rounded-3xl text-center shadow-md my-8">
                <Smile className="w-16 h-16 mx-auto text-amber-400 mb-2" />
                <p className="text-base font-bold text-amber-900">Aún no tienes contactos agregados.</p>
                <p className="text-xs text-amber-700 mt-1">Pídele a tu papá o mamá que invite a la abuelita o tíos con un código.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 mt-6">
                {contacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => onSelectContact(contact)}
                    className="flex flex-col items-center p-6 bg-white hover:bg-amber-100/90 active:scale-95 border-3 border-amber-300 rounded-3xl shadow-lg transition-all relative"
                  >
                    {contact.environment === 'church' && (
                      <span className="absolute top-3 right-3 text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300 px-2 py-0.5 rounded-full shadow-sm">
                        ⛪ Iglesia
                      </span>
                    )}
                    {(() => {
                      const unread = messages.filter(
                        (m) => m && m.fromUserId === contact.id && m.toUserId === currentUser.id && m.status !== 'read'
                      ).length;
                      return unread > 0 ? (
                        <span className="absolute top-3 left-3 text-[11px] font-black bg-red-500 text-white px-2 py-0.5 rounded-full shadow-md">
                          🔔 {unread} {unread === 1 ? 'nuevo' : 'nuevos'}
                        </span>
                      ) : null;
                    })()}
                    <div className="relative mb-3">
                      <img
                        src={contact.avatar}
                        alt={contact.username}
                        className="w-24 h-24 rounded-full border-4 border-amber-400 shadow-md bg-amber-50"
                      />
                      {onlineUsers.has(contact.id) && (
                        <span
                          className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-500 border-2 border-white rounded-full shadow"
                          title="En línea en la app"
                        />
                      )}
                    </div>
                    <span className="text-xl font-black text-amber-950 capitalize">{contact.username}</span>
                    <span className="text-xs font-bold text-amber-600 mt-1">
                      {contact.environment === 'church' ? 'Amiga de la iglesia' : 'Toca para platicar'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Active Chat View */
          <div className="flex-1 flex flex-col h-full bg-amber-50/50">
            {/* Messages Scroll Area */}
            <div className="flex-1 min-h-0 p-4 overflow-y-auto space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-12 text-amber-700 font-semibold text-sm">
                  🧸 Mándale un saludo, una foto o un audio a {activeContact.username}.
                </div>
              )}

              {messages.map((msg) => {
                const isMine = msg.fromUserId === currentUser.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-3xl p-4 shadow-md ${
                        isMine
                          ? 'bg-amber-400 text-amber-950 rounded-br-none border-2 border-amber-500'
                          : 'bg-white text-stone-900 rounded-bl-none border-2 border-amber-200'
                      }`}
                    >
                      {/* Text */}
                      {msg.type === 'text' && (
                        <p className="text-lg font-bold leading-relaxed">{msg.decryptedText}</p>
                      )}

                      {/* Photo */}
                      {msg.type === 'image' && (
                        <div className="rounded-2xl overflow-hidden border-2 border-white/50 my-1 max-w-xs">
                          {msg.isProtected && !(unlockedProtectedPhotos || []).includes(msg.id) ? (
                            <div
                              onClick={() => onUnlockProtectedPhoto && onUnlockProtectedPhoto(msg.id)}
                              className="p-6 bg-amber-100/95 border-2 border-dashed border-amber-400 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer text-center"
                            >
                              <div className="w-12 h-12 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center shadow-inner">
                                <Lock className="w-6 h-6" />
                              </div>
                              <span className="text-sm font-black text-amber-950">Foto Protegida con PIN</span>
                              <span className="text-xs font-bold text-amber-700">Pídele a tus papás que la desbloqueen</span>
                            </div>
                          ) : msg.decryptedMediaUrl ? (
                            <img
                              src={msg.decryptedMediaUrl}
                              alt="Foto"
                              className="w-full h-auto object-cover cursor-pointer hover:opacity-95 transition-opacity active:scale-[0.98]"
                              onClick={() =>
                                setFullscreenMedia({
                                  url: msg.decryptedMediaUrl,
                                  title: isMine ? 'Mi foto' : activeContact.username,
                                  subtitle: new Date(msg.timestamp).toLocaleString()
                                })
                              }
                            />
                          ) : (
                            <div className="p-8 text-center bg-amber-100 text-xs">Cargando foto segura...</div>
                          )}
                        </div>
                      )}

                      {/* Audio Note */}
                      {msg.type === 'audio' && (
                        <div className="flex items-center gap-3 py-1">
                          <button
                            onClick={() => msg.decryptedMediaUrl && toggleAudio(msg.id, msg.decryptedMediaUrl)}
                            className="w-12 h-12 rounded-full bg-amber-800 text-white flex items-center justify-center shadow-md active:scale-95"
                          >
                            {playingAudioId === msg.id ? (
                              <Pause className="w-6 h-6 fill-current" />
                            ) : (
                              <Play className="w-6 h-6 fill-current ml-0.5" />
                            )}
                          </button>
                          <div>
                            <span className="font-black text-sm block">Nota de Voz 🎵</span>
                            <span className="text-xs font-semibold opacity-75">
                              {msg.mediaDuration ? `${msg.mediaDuration}s` : 'Audio'}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-1.5 mt-1 text-[11px] font-bold opacity-75">
                        {msg.isEdited && <span className="text-amber-800 italic text-[9px]">(editado)</span>}
                        <span>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isMine && (
                          <span className="font-mono text-xs font-bold">
                            {msg.status === 'read' ? (
                              <span className="text-sky-600" title="Leído">✓✓</span>
                            ) : msg.status === 'delivered' ? (
                              <span className="text-amber-800" title="Entregado">✓✓</span>
                            ) : (
                              <span className="text-amber-800/80" title="Enviado">✓</span>
                            )}
                          </span>
                        )}
                        {isMine && msg.type === 'text' && (
                          <button
                            type="button"
                            onClick={() => setEditTargetMsg(msg)}
                            className="p-1 hover:text-amber-900 transition-colors"
                            title="Editar mensaje (Requiere PIN)"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDeleteTargetMsg(msg)}
                          className="p-1 hover:text-red-600 transition-colors"
                          title="Eliminar mensaje (Requiere PIN)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Giant Action Bar (Mobile Responsive) */}
            <div className="flex-shrink-0 p-2 sm:p-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] bg-amber-200/90 border-t-2 sm:border-t-3 border-amber-300 backdrop-blur z-10">
              <form onSubmit={handleSendText} className="flex items-center gap-1.5 sm:gap-2.5 max-w-3xl mx-auto w-full">
                <PhotoSender onSendPhoto={onSendPhoto} theme="kid" isRecipientMinor={true} />
                <AudioRecorder onSendAudio={onSendAudio} theme="kid" />

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onFocus={() => {
                    setTimeout(() => {
                      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
                    }, 300);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSendText(e);
                    }
                  }}
                  placeholder="Escribe algo..."
                  className="flex-1 min-w-0 py-2 sm:py-3 px-3.5 sm:px-4 rounded-full bg-white border-2 border-amber-400 text-amber-950 font-bold placeholder-amber-400 focus:outline-none focus:border-amber-600 text-sm sm:text-base shadow-inner"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-amber-500 hover:bg-amber-600 active:scale-95 disabled:opacity-40 text-white rounded-full shadow-lg transition-transform flex-shrink-0"
                  title="Enviar Mensaje"
                >
                  <Send className="w-5 h-5 sm:w-6 sm:h-6 ml-0.5" />
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Action Modals */}
      <DeleteOptionsModal
        isOpen={!!deleteTargetMsg}
        onClose={() => setDeleteTargetMsg(null)}
        onDeleteForMe={() => deleteTargetMsg && onDeleteMessage(deleteTargetMsg.id, 'for_me')}
        onDeleteForEveryone={() => deleteTargetMsg && onDeleteMessage(deleteTargetMsg.id, 'for_everyone')}
        isMine={deleteTargetMsg?.fromUserId === currentUser.id}
        isGuardian={currentUser.role === 'guardian'}
        theme="kid"
      />

      <EditMessageModal
        isOpen={!!editTargetMsg}
        onClose={() => setEditTargetMsg(null)}
        initialText={editTargetMsg?.decryptedText || ''}
        onSave={(newText) => editTargetMsg && onEditMessage(editTargetMsg.id, newText)}
        theme="kid"
      />

      <ClearChatModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onClearForMe={() => activeContact && onClearChat(activeContact.id, 'for_me')}
        onClearForEveryone={() => activeContact && onClearChat(activeContact.id, 'for_everyone')}
        contactName={activeContact?.username || ''}
        isGuardian={currentUser.role === 'guardian'}
        theme="kid"
      />

      <AvatarEditorModal
        isOpen={showAvatarModal}
        onClose={() => setShowAvatarModal(false)}
        currentUser={currentUser}
        onAvatarUpdated={(newAvatar) => {
          if (onUserUpdated) onUserUpdated({ ...currentUser, avatar: newAvatar });
        }}
      />

      <FullscreenMediaModal
        isOpen={!!fullscreenMedia}
        onClose={() => setFullscreenMedia(null)}
        mediaUrl={fullscreenMedia?.url || ''}
        title={fullscreenMedia?.title || ''}
        subtitle={fullscreenMedia?.subtitle}
      />
    </div>
  );
};
