import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Shield, UserPlus, Eye, Play, Pause, Trash2, Users, Edit3, Eraser, Image as ImageIcon, Lock, Sparkles, Camera, Settings, Handshake } from 'lucide-react';
import { AudioRecorder } from './AudioRecorder';
import { PhotoSender } from './PhotoSender';
import { DeleteOptionsModal } from './DeleteOptionsModal';
import { EditMessageModal } from './EditMessageModal';
import { ClearChatModal } from './ClearChatModal';
import { AvatarEditorModal } from './AvatarEditorModal';
import { AddChildModal } from './AddChildModal';
import { ConnectKidsModal } from './ConnectKidsModal';
import { HandshakeRequestsModal } from './HandshakeRequestsModal';

interface AdultsViewProps {
  currentUser: any;
  contacts: any[];
  activeContact: any;
  onSelectContact: (contact: any) => void;
  onBackToContacts: () => void;
  messages: any[];
  mirrorMessages: any[];
  childrenList: any[];
  onSendMessage: (text: string) => void;
  onSendAudio: (blob: Blob, duration: number) => void;
  onSendPhoto: (blob: Blob, isProtected?: boolean) => void;
  onDeleteMessage: (msgId: string, mode: 'for_me' | 'for_everyone') => void;
  onEditMessage: (msgId: string, newText: string) => void;
  onClearChat: (contactId: string, mode: 'for_me' | 'for_everyone') => void;
  onOpenInviteModal: () => void;
  onLogout: () => void;
  onOpenPhotosVault: () => void;
  onOpenSettings?: () => void;
  handshakes?: any[];
  onRefreshHandshakes?: () => void;
  unlockedProtectedPhotos?: string[];
  onUnlockProtectedPhoto?: (msgId: string) => void;
  onRefreshContacts?: () => void;
  onUserUpdated?: (user: any) => void;
}

export const AdultsView: React.FC<AdultsViewProps> = ({
  currentUser,
  contacts,
  activeContact,
  onSelectContact,
  onBackToContacts,
  messages,
  mirrorMessages,
  childrenList,
  onSendMessage,
  onSendAudio,
  onSendPhoto,
  onDeleteMessage,
  onEditMessage,
  onClearChat,
  onOpenInviteModal,
  onLogout,
  onOpenPhotosVault,
  onOpenSettings,
  handshakes = [],
  onRefreshHandshakes,
  unlockedProtectedPhotos,
  onUnlockProtectedPhoto,
  onRefreshContacts,
  onUserUpdated
}) => {
  const [activeTab, setActiveTab] = useState<'chats' | 'mirror'>('chats');
  const [selectedMirrorChild, setSelectedMirrorChild] = useState<any>(null);
  const [inputText, setInputText] = useState('');
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [deleteTargetMsg, setDeleteTargetMsg] = useState<any | null>(null);
  const [editTargetMsg, setEditTargetMsg] = useState<any | null>(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showAddChildModal, setShowAddChildModal] = useState(false);
  const [showConnectKidsModal, setShowConnectKidsModal] = useState(false);
  const [connectTargetGuardian, setConnectTargetGuardian] = useState<any>(null);
  const [showHandshakesModal, setShowHandshakesModal] = useState(false);
  const [envFilter, setEnvFilter] = useState<'all' | 'family' | 'church' | 'work'>('all');
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, mirrorMessages]);

  const toggleAudio = (msgId: string, url: string) => {
    if (playingAudioId === msgId) {
      audioPlayerRef.current?.pause();
      setPlayingAudioId(null);
      return;
    }
    if (audioPlayerRef.current) audioPlayerRef.current.pause();
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

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const kidsUnder10 = childrenList.filter(c => c.age && c.age < 10);

  const contactIsMinor = activeContact && (
    activeContact.role === 'kid' ||
    activeContact.role === 'teen' ||
    (activeContact.age !== undefined && activeContact.age < 18)
  );
  const isLegalGuardianOfContact = contactIsMinor && activeContact.guardianId === currentUser.id;
  const canDeleteForEveryone = !contactIsMinor || isLegalGuardianOfContact;

  return (
    <div className="flex h-full h-[100dvh] max-h-[100dvh] bg-slate-950 text-slate-100 font-sans select-none overflow-hidden">
      {/* Sidebar: Contacts & Mirror Selector */}
      <aside className={`w-full md:w-80 lg:w-80 flex-shrink-0 border-r border-slate-800 bg-slate-900/95 flex flex-col ${
        activeContact || (activeTab === 'mirror' && selectedMirrorChild) ? 'hidden md:flex' : 'flex'
      }`}>
        {/* User profile header */}
        <header className="p-4 border-b border-slate-800 bg-slate-900 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div
              onClick={() => setShowAvatarModal(true)}
              className="relative cursor-pointer group"
              title="Toca para cambiar tu foto de perfil"
            >
              <img
                src={currentUser.avatar}
                alt="Avatar"
                className="w-10 h-10 rounded-full border border-indigo-500/40 object-cover bg-slate-800 shadow"
              />
              <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                <Camera className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="font-semibold text-sm text-white">{currentUser.username}</div>
              <div className="text-[11px] font-medium text-indigo-400 flex items-center gap-1">
                <Shield className="w-3 h-3 text-indigo-400" /> Panel Guardián
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                title="Ajustes y Dispositivo"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onLogout}
              className="text-xs font-medium text-slate-400 hover:text-white px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Salir
            </button>
          </div>
        </header>

        {/* Tab switcher: Normal Chats vs Mirror Oversight */}
        <div className="p-3 border-b border-slate-800/80 bg-slate-900/50 flex gap-2 flex-shrink-0">
          <button
            onClick={() => { setActiveTab('chats'); setSelectedMirrorChild(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'chats'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Chats Familiares
          </button>

          {currentUser.role === 'guardian' && (
            <button
              onClick={() => setActiveTab('mirror')}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'mirror'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Eye className="w-3.5 h-3.5" /> Modo Espejo (&lt;10)
            </button>
          )}
        </div>

        {/* Pending Handshakes Banner */}
        {handshakes.some((h: any) => h.toGuardianId === currentUser.id && h.status === 'pending') && (
          <div
            onClick={() => setShowHandshakesModal(true)}
            className="mx-3 mt-2 p-2.5 bg-gradient-to-r from-purple-900/70 to-indigo-900/70 border border-purple-500/50 rounded-2xl cursor-pointer hover:border-purple-400 transition-all flex items-center justify-between shadow-lg"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-purple-200">
              <Handshake className="w-4 h-4 text-purple-400 animate-pulse" />
              <span>Solicitud de Conexión de Hijos</span>
            </div>
            <span className="text-[10px] bg-purple-500 text-white font-black px-2 py-0.5 rounded-full">
              Revisar
            </span>
          </div>
        )}

        {/* Environment Filter Chips */}
        {activeTab === 'chats' && (
          <div className="px-3 pt-2.5 flex items-center gap-1.5 overflow-x-auto text-[11px] font-semibold text-slate-400 flex-shrink-0">
            <button
              type="button"
              onClick={() => setEnvFilter('all')}
              className={`px-2.5 py-1 rounded-xl transition-all whitespace-nowrap ${
                envFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              🌐 Todos
            </button>
            <button
              type="button"
              onClick={() => setEnvFilter('family')}
              className={`px-2.5 py-1 rounded-xl transition-all whitespace-nowrap ${
                envFilter === 'family'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              🏠 Familia
            </button>
            <button
              type="button"
              onClick={() => setEnvFilter('church')}
              className={`px-2.5 py-1 rounded-xl transition-all whitespace-nowrap ${
                envFilter === 'church'
                  ? 'bg-purple-600 text-white shadow'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              ⛪ Iglesia
            </button>
            <button
              type="button"
              onClick={() => setEnvFilter('work')}
              className={`px-2.5 py-1 rounded-xl transition-all whitespace-nowrap ${
                envFilter === 'work'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              💼 Trabajo
            </button>
          </div>
        )}

        {/* Action Button: Invite family member */}
        <div className="px-3 pt-2 flex-shrink-0 space-y-1.5">
          <button
            onClick={onOpenPhotosVault}
            className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-950/60 to-indigo-950/60 hover:from-purple-900/70 hover:to-indigo-900/70 border border-purple-500/30 text-purple-200 font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <ImageIcon className="w-4 h-4 text-purple-400" /> 📸 Bóveda de Fotos Familiar
          </button>

          {currentUser.role === 'guardian' && (
            <button
              onClick={() => setShowAddChildModal(true)}
              className="w-full py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              <Sparkles className="w-4 h-4 text-amber-400" /> + Agregar Hijo/a a la Familia
            </button>
          )}

          <button
            onClick={onOpenInviteModal}
            className="w-full py-2 px-3 rounded-xl border border-dashed border-indigo-500/40 bg-indigo-950/30 hover:bg-indigo-900/40 text-indigo-300 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <UserPlus className="w-4 h-4 text-indigo-400" /> Invitar a Familiar
          </button>
        </div>

        {/* Contact List */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
          {activeTab === 'chats' ? (
            contacts.filter(c => envFilter === 'all' || (c.environment || 'family') === envFilter).length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                {envFilter === 'all'
                  ? 'Aún no tienes contactos. Haz clic en "Invitar Familiar" para generar un código seguro.'
                  : `No hay contactos en el entorno ${envFilter === 'church' ? '⛪ Iglesia' : envFilter === 'work' ? '💼 Trabajo' : '🏠 Familia'}.`}
              </div>
            ) : (
              contacts
                .filter(c => envFilter === 'all' || (c.environment || 'family') === envFilter)
                .map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => onSelectContact(contact)}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                      activeContact?.id === contact.id
                        ? 'bg-indigo-950/70 text-white border-indigo-500/40 shadow-sm'
                        : 'border-transparent hover:bg-slate-800/60 text-slate-300'
                    }`}
                  >
                    <img
                      src={contact.avatar}
                      alt=""
                      className="w-11 h-11 rounded-full border border-slate-700 object-cover bg-slate-800"
                    />
                    <div className="text-left flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate flex items-center justify-between">
                        <span className="text-white">{contact.username}</span>
                        <div className="flex items-center gap-1">
                          {contact.environment === 'church' && (
                            <span className="text-[9px] bg-purple-950 text-purple-300 border border-purple-800/60 px-1.5 py-0.2 rounded-full font-bold">
                              ⛪ Iglesia
                            </span>
                          )}
                          {contact.environment === 'work' && (
                            <span className="text-[9px] bg-cyan-950 text-cyan-300 border border-cyan-800/60 px-1.5 py-0.2 rounded-full font-bold">
                              💼 Trabajo
                            </span>
                          )}
                          <span className="text-[10px] text-indigo-400/80 capitalize font-mono px-1.5 py-0.5 rounded bg-slate-800/80">
                            {contact.role}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-slate-400 truncate flex items-center gap-1 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" /> Canal seguro E2EE
                      </div>
                    </div>
                  </button>
                ))
            )
          ) : (
            /* Mirror View Selection for Kids < 10 */
            <div className="space-y-2">
              <div className="p-3 bg-amber-950/30 border border-amber-800/50 rounded-2xl text-[11px] text-amber-300 leading-relaxed">
                <strong className="text-amber-200">Supervisión de Menores (&lt;10 años):</strong> Gracias al doble cifrado asimétrico, recibes copia descifrada de sus conversaciones en modo auditoría.
              </div>
              {kidsUnder10.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No tienes hijos menores de 10 años registrados en tu cuenta familiar.
                </div>
              ) : (
                kidsUnder10.map((kid) => (
                  <button
                    key={kid.id}
                    onClick={() => setSelectedMirrorChild(kid)}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                      selectedMirrorChild?.id === kid.id
                        ? 'border-amber-500 bg-amber-950/40 text-white shadow-md'
                        : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <img
                      src={kid.avatar}
                      alt=""
                      className="w-12 h-12 rounded-full border-2 border-amber-400/70 object-cover bg-slate-800"
                    />
                    <div className="text-left flex-1">
                      <div className="font-bold text-sm text-white">{kid.username}</div>
                      <div className="text-xs text-amber-400 font-medium">Edad: {kid.age} años • Auditoría Activa</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Main Area: Chat or Mirror Audit */}
      <section className={`flex-1 flex flex-col h-full bg-slate-950 ${
        !activeContact && (!selectedMirrorChild || activeTab !== 'mirror')
          ? 'hidden md:flex items-center justify-center bg-slate-950'
          : 'flex'
      }`}>
        {/* State: No selection */}
        {!activeContact && (!selectedMirrorChild || activeTab !== 'mirror') ? (
          <div className="text-center text-slate-400 space-y-3 max-w-sm p-6">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400 shadow-lg">
              <Shield className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-base text-white">Canal de Comunicaciones Privado</h3>
            <p className="text-xs leading-relaxed text-slate-400">
              Cifrado de extremo a extremo sin número telefónico. Selecciona un chat de la lista o supervisa las conversaciones de tus hijos menores.
            </p>
          </div>
        ) : activeTab === 'mirror' && selectedMirrorChild ? (
          /* MIRROR AUDIT VIEW */
          <div className="flex-1 flex flex-col h-full bg-slate-950">
            <header className="px-6 py-3.5 border-b border-amber-900/40 bg-amber-950/20 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedMirrorChild(null)}
                  className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <img
                  src={selectedMirrorChild.avatar}
                  alt=""
                  className="w-10 h-10 rounded-full border-2 border-amber-400/80 object-cover bg-slate-800"
                />
                <div>
                  <h3 className="font-bold text-sm text-white">
                    Vista Espejo: Conversaciones de {selectedMirrorChild.username}
                  </h3>
                  <span className="text-[11px] font-medium text-amber-400 flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" /> Modo Auditoría Transparente (Lectura Protegida)
                  </span>
                </div>
              </div>
            </header>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
              {mirrorMessages.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No hay mensajes registrados aún en las conversaciones de {selectedMirrorChild.username}.
                </div>
              ) : (
                mirrorMessages.map((msg) => (
                  <div key={msg.id} className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl shadow-md max-w-lg mx-auto">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 border-b border-slate-800 pb-1">
                      <span className="font-semibold text-indigo-400">
                        {msg.fromUserId === selectedMirrorChild.id ? selectedMirrorChild.username : 'Familiar'}
                      </span>
                      <span className="text-slate-500">{new Date(msg.timestamp).toLocaleString()}</span>
                    </div>

                    {msg.type === 'text' && <p className="text-sm text-slate-200 leading-relaxed">{msg.decryptedText}</p>}

                    {msg.type === 'image' && (
                      <div className="rounded-xl overflow-hidden my-2 max-w-xs border border-slate-700 relative">
                        {msg.isProtected && (
                          <div className="absolute top-2 right-2 p-1 bg-amber-500 text-slate-950 rounded-md text-[10px] font-bold flex items-center gap-1 shadow">
                            <Lock className="w-3 h-3" /> Protegida
                          </div>
                        )}
                        {msg.decryptedMediaUrl ? (
                          <img src={msg.decryptedMediaUrl} alt="" className="w-full h-auto object-cover" />
                        ) : (
                          <div className="p-4 text-xs text-slate-400 bg-slate-800 text-center">Cargando foto...</div>
                        )}
                      </div>
                    )}

                    {msg.type === 'audio' && (
                      <div className="flex items-center gap-3 py-1">
                        <button
                          onClick={() => msg.decryptedMediaUrl && toggleAudio(msg.id, msg.decryptedMediaUrl)}
                          className="w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow"
                        >
                          {playingAudioId === msg.id ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                        </button>
                        <span className="text-xs text-slate-300 font-medium">Nota de voz ({msg.mediaDuration}s)</span>
                      </div>
                    )}

                    {/* Guardian Action: Delete message */}
                    <div className="flex justify-end mt-2 pt-1 border-t border-slate-800">
                      <button
                        onClick={() => onDeleteMessage(msg.id, 'for_everyone')}
                        className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 font-medium transition-colors"
                      >
                        <Trash2 className="w-3 h-3" /> Borrar como Guardián
                      </button>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        ) : (
          /* STANDARD 1-ON-1 CHAT */
          <>
            <header className="px-6 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 backdrop-blur flex-shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={onBackToContacts}
                  className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <img
                  src={activeContact.avatar}
                  alt=""
                  className="w-10 h-10 rounded-full border border-slate-700 object-cover bg-slate-800 shadow"
                />
                <div>
                  <h3 className="font-bold text-sm text-white">{activeContact.username}</h3>
                  <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" /> Canal Cifrado Activo
                  </span>
                </div>
              </div>

              {/* Chat action: Clear chat & photos */}
              <div className="flex items-center gap-2">
                {activeContact.role === 'guardian' && activeContact.id !== currentUser.id && (
                  <button
                    type="button"
                    onClick={() => {
                      setConnectTargetGuardian(activeContact);
                      setShowConnectKidsModal(true);
                    }}
                    className="text-xs text-purple-200 hover:text-white px-2.5 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 flex items-center gap-1.5 transition-colors shadow-sm"
                    title="Conectar a nuestros hijos"
                  >
                    <Handshake className="w-3.5 h-3.5 text-purple-400" />
                    <span className="hidden sm:inline">Conectar Hijos</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onOpenPhotosVault}
                  className="text-xs text-purple-200 hover:text-white px-2.5 py-1.5 rounded-xl bg-purple-950/40 hover:bg-purple-900/50 border border-purple-500/30 flex items-center gap-1.5 transition-colors shadow-sm"
                  title="Bóveda de Fotos"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
                  <span className="hidden sm:inline">Fotos</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowClearModal(true)}
                  className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 flex items-center gap-1.5 transition-colors shadow-sm"
                  title="Limpiar conversación"
                >
                  <Eraser className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden sm:inline">Limpiar chat</span>
                </button>
              </div>
            </header>

            {/* Messages Container */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-3 bg-slate-950">
              <div className="w-full max-w-4xl mx-auto space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center py-16 text-slate-500 text-xs">
                    Inicia la conversación segura con {activeContact.username}. Cifrado de extremo a extremo activo.
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.fromUserId === currentUser.id;
                    const isPhotoProtected = msg.isProtected && !(unlockedProtectedPhotos || []).includes(msg.id);

                    return (
                      <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} group`}>
                        <div
                          className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-3.5 shadow-md relative ${
                            isMine
                              ? 'bg-indigo-600 text-white rounded-br-none'
                              : 'bg-slate-900 text-slate-100 rounded-bl-none border border-slate-800'
                          }`}
                        >
                          {msg.type === 'text' && <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.decryptedText}</p>}

                          {msg.type === 'image' && (
                            <div className="rounded-xl overflow-hidden my-1 max-w-sm border border-black/20">
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
                                <div className="p-4 text-xs text-slate-400 text-center">Descifrando foto...</div>
                              )}
                            </div>
                          )}

                          {msg.type === 'audio' && (
                            <div className="flex items-center gap-3 py-1">
                              <button
                                type="button"
                                onClick={() => msg.decryptedMediaUrl && toggleAudio(msg.id, msg.decryptedMediaUrl)}
                                className={`w-9 h-9 rounded-full flex items-center justify-center transition-transform active:scale-95 ${
                                  isMine ? 'bg-indigo-800 text-white' : 'bg-slate-800 text-indigo-400'
                                }`}
                              >
                                {playingAudioId === msg.id ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                              </button>
                              <span className="text-xs font-medium">Nota de voz ({msg.mediaDuration}s)</span>
                            </div>
                          )}

                          <div className="flex items-center justify-end gap-2 mt-1 text-[10px] opacity-75">
                            {msg.isEdited && <span className="text-slate-400 italic text-[9px]">(editado)</span>}
                            <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {isMine && <span className="text-indigo-200 font-mono">✓✓</span>}
                            {isMine && msg.type === 'text' && (
                              <button
                                type="button"
                                onClick={() => setEditTargetMsg(msg)}
                                className="opacity-0 group-hover:opacity-100 hover:text-indigo-300 transition-opacity p-0.5"
                                title="Editar mensaje"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setDeleteTargetMsg(msg)}
                              className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity p-0.5"
                              title="Eliminar mensaje"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Bar (Footer) */}
            <div className="p-3 border-t border-slate-800 bg-slate-900 flex-shrink-0">
              <form onSubmit={handleSend} className="flex items-center gap-2 max-w-4xl mx-auto">
                <PhotoSender onSendPhoto={onSendPhoto} theme="adult" />
                <AudioRecorder onSendAudio={onSendAudio} theme="adult" />

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
                  placeholder="Escribe un mensaje cifrado..."
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl transition-all shadow-md active:scale-95 flex-shrink-0"
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
        canDeleteForEveryone={canDeleteForEveryone}
        everyoneRestrictionReason={
          contactIsMinor && !isLegalGuardianOfContact
            ? `Solo el tutor legal de @${activeContact?.username} puede eliminar mensajes para todos.`
            : undefined
        }
        theme="adult"
      />

      <EditMessageModal
        isOpen={!!editTargetMsg}
        onClose={() => setEditTargetMsg(null)}
        initialText={editTargetMsg?.decryptedText || ''}
        onSave={(newText) => editTargetMsg && onEditMessage(editTargetMsg.id, newText)}
        theme="adult"
      />

      <ClearChatModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onClearForMe={() => activeContact && onClearChat(activeContact.id, 'for_me')}
        onClearForEveryone={() => activeContact && onClearChat(activeContact.id, 'for_everyone')}
        contactName={activeContact?.username || ''}
        isGuardian={currentUser.role === 'guardian'}
        canClearForEveryone={canDeleteForEveryone}
        everyoneRestrictionReason={
          contactIsMinor && !isLegalGuardianOfContact
            ? `Solo el tutor legal de @${activeContact?.username} puede vaciar la conversación para todos.`
            : undefined
        }
        theme="adult"
      />

      <AvatarEditorModal
        isOpen={showAvatarModal}
        onClose={() => setShowAvatarModal(false)}
        currentUser={currentUser}
        onAvatarUpdated={(newAvatar) => {
          if (onUserUpdated) onUserUpdated({ ...currentUser, avatar: newAvatar });
        }}
      />

      <AddChildModal
        isOpen={showAddChildModal}
        onClose={() => setShowAddChildModal(false)}
        guardianId={currentUser.id}
        onChildCreated={() => {
          if (onRefreshContacts) onRefreshContacts();
        }}
      />

      <ConnectKidsModal
        isOpen={showConnectKidsModal}
        onClose={() => setShowConnectKidsModal(false)}
        currentUser={currentUser}
        targetGuardian={connectTargetGuardian}
        myChildren={childrenList}
        onSuccess={() => {
          if (onRefreshContacts) onRefreshContacts();
          if (onRefreshHandshakes) onRefreshHandshakes();
        }}
      />

      <HandshakeRequestsModal
        isOpen={showHandshakesModal}
        onClose={() => setShowHandshakesModal(false)}
        currentUser={currentUser}
        handshakes={handshakes}
        onRefresh={() => {
          if (onRefreshContacts) onRefreshContacts();
          if (onRefreshHandshakes) onRefreshHandshakes();
        }}
      />
    </div>
  );
};
