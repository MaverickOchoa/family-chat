import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, ShieldCheck, Play, Pause, Trash2, Edit3, Eraser, Image as ImageIcon, Lock } from 'lucide-react';
import { AudioRecorder } from './AudioRecorder';
import { PhotoSender } from './PhotoSender';
import { DeleteOptionsModal } from './DeleteOptionsModal';
import { EditMessageModal } from './EditMessageModal';
import { ClearChatModal } from './ClearChatModal';

interface TeensViewProps {
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
  unlockedProtectedPhotos?: string[];
  onUnlockProtectedPhoto?: (msgId: string) => void;
}

export const TeensView: React.FC<TeensViewProps> = ({
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
  unlockedProtectedPhotos,
  onUnlockProtectedPhoto
}) => {
  const [inputText, setInputText] = useState('');
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [deleteTargetMsg, setDeleteTargetMsg] = useState<any | null>(null);
  const [editTargetMsg, setEditTargetMsg] = useState<any | null>(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleAudio = (msgId: string, url: string) => {
    if (playingAudioId === msgId) {
      audioPlayerRef.current?.pause();
      setPlayingAudioId(null);
    } else {
      if (audioPlayerRef.current) audioPlayerRef.current.pause();
      const audio = new Audio(url);
      audioPlayerRef.current = audio;
      setPlayingAudioId(msgId);
      audio.play();
      audio.onended = () => setPlayingAudioId(null);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  return (
    <div className="flex h-full h-[100dvh] max-h-[100dvh] bg-slate-950 text-slate-100 font-sans select-none overflow-hidden">
      {/* Sidebar (Contacts) */}
      <aside className={`w-full md:w-80 border-r border-slate-800 bg-slate-900/60 flex flex-col ${
        activeContact ? 'hidden md:flex' : 'flex'
      }`}>
        <header className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img src={currentUser.avatar} alt="Avatar" className="w-10 h-10 rounded-full border border-cyan-500/50 bg-slate-800" />
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-900" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-wide text-white block">@{currentUser.username}</span>
              <span className="text-[11px] font-mono text-cyan-400">TEEN ZONE (10-17)</span>
            </div>
          </div>
          <button onClick={onLogout} className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800">
            Salir
          </button>
        </header>

        <div className="px-4 py-2 bg-cyan-950/20 border-b border-cyan-900/30 flex items-center gap-2 text-[11px] text-cyan-400">
          <ShieldCheck className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <span>Cifrado E2EE personal activo. Tus chats son privados.</span>
        </div>

        <div className="px-3 pt-2.5 flex-shrink-0">
          <button
            onClick={onOpenPhotosVault}
            className="w-full py-2 px-3 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/30 text-cyan-300 font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <ImageIcon className="w-4 h-4 text-cyan-400" /> 📸 Bóveda de Fotos
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {contacts.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              No tienes contactos activos aún. Solo personas invitadas por tu familia pueden contactarte.
            </div>
          ) : (
            contacts.map((contact) => (
              <button
                key={contact.id}
                onClick={() => onSelectContact(contact)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                  activeContact?.id === contact.id
                    ? 'bg-cyan-500/10 border border-cyan-500/30 text-white'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <img src={contact.avatar} alt="" className="w-11 h-11 rounded-full border border-slate-700 bg-slate-800" />
                <div className="text-left flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{contact.username}</div>
                  <div className="text-xs text-slate-500 truncate">Canal seguro verificado</div>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Main Chat Area */}
      <section className={`flex-1 flex flex-col h-full bg-slate-950 ${
        !activeContact ? 'hidden md:flex items-center justify-center' : 'flex'
      }`}>
        {!activeContact ? (
          <div className="text-center text-slate-500 space-y-2 max-w-sm p-6">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-slate-300">Selecciona un chat</h3>
            <p className="text-xs">Tus mensajes están protegidos por criptografía punta a punta de grado militar.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-800/80 bg-slate-900/40 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <button onClick={onBackToContacts} className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <img src={activeContact.avatar} alt="" className="w-9 h-9 rounded-full border border-slate-700" />
                <div>
                  <div className="font-bold text-sm text-white">{activeContact.username}</div>
                  <div className="text-[10px] font-mono text-cyan-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" /> E2EE P2P Session
                  </div>
                </div>
              </div>

              {/* Chat actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenPhotosVault}
                  className="text-xs text-cyan-300 hover:text-white px-2.5 py-1.5 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/30 flex items-center gap-1.5 transition-colors shadow-sm"
                  title="Bóveda de Fotos"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">Fotos</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowClearModal(true)}
                  className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 flex items-center gap-1.5 transition-colors shadow-sm"
                  title="Limpiar conversación"
                >
                  <Eraser className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">Limpiar chat</span>
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => {
                const isMine = msg.fromUserId === currentUser.id;
                const isPhotoProtected = msg.isProtected && !(unlockedProtectedPhotos || []).includes(msg.id);

                return (
                  <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} group`}>
                    <div
                      className={`max-w-[75%] rounded-2xl p-3.5 shadow-lg relative ${
                        isMine
                          ? 'bg-cyan-600/90 text-white rounded-br-xs border border-cyan-500/40'
                          : 'bg-slate-800/90 text-slate-100 rounded-bl-xs border border-slate-700/60'
                      }`}
                    >
                      {msg.type === 'text' && <p className="text-sm leading-relaxed">{msg.decryptedText}</p>}

                      {msg.type === 'image' && (
                        <div className="rounded-xl overflow-hidden my-1 max-w-sm">
                          {isPhotoProtected ? (
                            <div
                              onClick={() => onUnlockProtectedPhoto && onUnlockProtectedPhoto(msg.id)}
                              className="p-5 bg-slate-950/90 backdrop-blur-sm border border-amber-500/40 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-900 transition-all text-center"
                            >
                              <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
                                <Lock className="w-5 h-5" />
                              </div>
                              <span className="text-xs font-bold text-amber-300">Foto Protegida con PIN</span>
                              <span className="text-[10px] text-slate-400">Toca para desbloquear</span>
                            </div>
                          ) : msg.decryptedMediaUrl ? (
                            <img src={msg.decryptedMediaUrl} alt="Foto" className="w-full h-auto object-cover" />
                          ) : (
                            <div className="p-6 text-center text-xs text-slate-400">Descifrando imagen...</div>
                          )}
                        </div>
                      )}

                      {msg.type === 'audio' && (
                        <div className="flex items-center gap-3 py-1">
                          <button
                            onClick={() => msg.decryptedMediaUrl && toggleAudio(msg.id, msg.decryptedMediaUrl)}
                            className="w-10 h-10 rounded-full bg-slate-900/80 text-cyan-400 flex items-center justify-center hover:bg-slate-900"
                          >
                            {playingAudioId === msg.id ? (
                              <Pause className="w-5 h-5 fill-current" />
                            ) : (
                              <Play className="w-5 h-5 fill-current ml-0.5" />
                            )}
                          </button>
                          <div>
                            <span className="font-semibold text-xs block text-cyan-200">Mensaje de Voz</span>
                            <span className="text-[11px] text-slate-400">{msg.mediaDuration ? `${msg.mediaDuration}s` : 'Audio'}</span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 mt-1.5 text-[10px] text-slate-300/80">
                        {msg.isEdited && <span className="text-cyan-200 italic text-[9px]">(editado)</span>}
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {isMine && <span className="text-cyan-200">✓✓</span>}
                        {isMine && msg.type === 'text' && (
                          <button
                            type="button"
                            onClick={() => setEditTargetMsg(msg)}
                            className="opacity-0 group-hover:opacity-100 hover:text-cyan-300 transition-opacity p-0.5"
                            title="Editar mensaje"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteTargetMsg(msg)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 transition-opacity"
                          title="Eliminar mensaje"
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

            {/* Input Bar */}
            <div className="p-3 border-t border-slate-800 bg-slate-900/40 flex-shrink-0">
              <form onSubmit={handleSend} className="flex items-center gap-2 max-w-4xl mx-auto">
                <PhotoSender onSendPhoto={onSendPhoto} theme="teen" />
                <AudioRecorder onSendAudio={onSendAudio} theme="teen" />

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSend(e);
                    }
                  }}
                  placeholder="Escribe un mensaje seguro..."
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-sm"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="p-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white rounded-xl transition-all shadow-md"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </>
        )}
      </section>

      {/* Action Modals */}
      <DeleteOptionsModal
        isOpen={!!deleteTargetMsg}
        onClose={() => setDeleteTargetMsg(null)}
        onDeleteForMe={() => deleteTargetMsg && onDeleteMessage(deleteTargetMsg.id, 'for_me')}
        onDeleteForEveryone={() => deleteTargetMsg && onDeleteMessage(deleteTargetMsg.id, 'for_everyone')}
        isMine={deleteTargetMsg?.fromUserId === currentUser.id}
        isGuardian={currentUser.role === 'guardian'}
        theme="teen"
      />

      <EditMessageModal
        isOpen={!!editTargetMsg}
        onClose={() => setEditTargetMsg(null)}
        initialText={editTargetMsg?.decryptedText || ''}
        onSave={(newText) => editTargetMsg && onEditMessage(editTargetMsg.id, newText)}
        theme="teen"
      />

      <ClearChatModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onClearForMe={() => activeContact && onClearChat(activeContact.id, 'for_me')}
        onClearForEveryone={() => activeContact && onClearChat(activeContact.id, 'for_everyone')}
        contactName={activeContact?.username || ''}
        isGuardian={currentUser.role === 'guardian'}
        theme="teen"
      />
    </div>
  );
};
