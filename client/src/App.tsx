import React, { useState, useEffect, useRef } from 'react';
import {
  generateIdentityKeyPair,
  deriveDeterministicKeyPair,
  derivePublicKey,
  exportPrivateKey,
  importPrivateKey,
  encryptTextMessage,
  decryptTextMessage,
  encryptMediaBlob,
  decryptMediaBlob,
  type UserKeyPair
} from './crypto/e2ee';
import { KidsView } from './components/KidsView';
import { TeensView } from './components/TeensView';
import { AdultsView } from './components/AdultsView';
import { InviteModal } from './components/InviteModal';
import { ParentPinModal } from './components/ParentPinModal';
import { FamilyPhotosVault } from './components/FamilyPhotosVault';
import { SettingsModal } from './components/SettingsModal';
import { AvatarCropperModal } from './components/AvatarCropperModal';
import { Shield, Camera, Lock, User, Upload, Mail } from 'lucide-react';
import { API_BASE, WS_BASE } from './config';

// Universal UUID generator that works in any context (HTTP, LAN IP, older mobile browsers)
function safeUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Password validation rules: minimum 8 chars, 1 uppercase, 1 lowercase, 1 symbol
function validatePassword(pwd: string): string | null {
  if (pwd.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  if (!/[A-Z]/.test(pwd)) {
    return 'La contraseña debe incluir al menos una letra mayúscula.';
  }
  if (!/[a-z]/.test(pwd)) {
    return 'La contraseña debe incluir al menos una letra minúscula.';
  }
  if (!/[^A-Za-z0-9]/.test(pwd)) {
    return 'La contraseña debe incluir al menos un signo o símbolo especial (!@#$%&*...).';
  }
  return null;
}

export function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userKeyPair, setUserKeyPair] = useState<UserKeyPair | null>(null);
  const [keyring, setKeyring] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('family_chat_keyring') || '[]');
    } catch {
      return [];
    }
  });
  const [contacts, setContacts] = useState<any[]>([]);
  const [activeContact, setActiveContact] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [childrenList, setChildrenList] = useState<any[]>([]);
  const [currentTab, setCurrentTab] = useState<'chat' | 'photos'>('chat');
  const [unlockedProtectedPhotos, setUnlockedProtectedPhotos] = useState<string[]>([]);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [currentEnvironment, setCurrentEnvironment] = useState<string>('all');
  const [handshakes, setHandshakes] = useState<any[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [pinModalTitle, setPinModalTitle] = useState('Autorización de Guardián Requerida');
  const [pinModalDesc, setPinModalDesc] = useState('Para proteger a los menores, esta acción requiere el PIN de tus padres.');

  // Auth Form State
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [usernameInput, setUsernameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [rawAvatarToCrop, setRawAvatarToCrop] = useState<string | null>(null);
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);
  const [roleInput, setRoleInput] = useState<'guardian' | 'teen' | 'kid'>('guardian');
  const [ageInput, setAgeInput] = useState<number>(35);
  const [guardianUsernameInput, setGuardianUsernameInput] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  // Check saved session on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'photos') {
      setCurrentTab('photos');
    }

    const savedUser = localStorage.getItem('family_chat_user');
    const savedPrivKey = localStorage.getItem('family_chat_privkey');
    const savedPubKey = localStorage.getItem('family_chat_pubkey');
    const savedKeyring: string[] = JSON.parse(localStorage.getItem('family_chat_keyring') || '[]');
    setKeyring(savedKeyring);

    if (savedUser && savedPrivKey) {
      // Auto-migrate: If old RSA key is detected, clear it to ensure clean X25519 keys
      if (savedPrivKey.length > 60) {
        localStorage.clear();
        setCurrentUser(null);
        setUserKeyPair(null);
        return;
      }
      try {
        const parsed = JSON.parse(savedUser);
        const derivedPub = derivePublicKey(savedPrivKey);
        if (derivedPub) {
          localStorage.setItem('family_chat_pubkey', derivedPub);
          setCurrentUser(parsed);
          setUserKeyPair({
            publicKeyBase64: derivedPub,
            privateKeyBase64: savedPrivKey
          });

          // Always push true derived public key to server
          fetch(`${API_BASE}/api/users/${parsed.id}/public-key`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ publicKey: derivedPub })
          }).catch(console.error);
        }
      } catch (e) {
        console.error('Failed to restore session:', e);
      }
    }
  }, []);

  // Sync data when currentUser & userKeyPair are ready
  useEffect(() => {
    if (!currentUser || !userKeyPair) return;

    fetchContacts();
    fetchMessages();
    if (currentUser?.role === 'guardian') {
      fetchHandshakes();
    }

    // Auto-refresh messages and contacts periodically in case WebSocket reconnects
    const pollInterval = setInterval(() => {
      fetchMessages();
      fetchContacts();
      if (currentUser?.role === 'guardian') {
        fetchHandshakes();
      }
    }, 3000);

    const ws = new WebSocket(WS_BASE);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'auth',
        userId: currentUser.id,
        publicKey: userKeyPair.publicKeyBase64
      }));
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'new_message' || data.type === 'mirror_message') {
          await handleIncomingPacket(data.message);
        } else if (data.type === 'delete_message') {
          setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
        } else if (data.type === 'edit_message') {
          await handleIncomingEdit(data.message);
        } else if (data.type === 'status_update') {
          setMessages((prev) =>
            prev.map((m) => (m.id === data.messageId ? { ...m, status: data.status } : m))
          );
        } else if (data.type === 'initial_presence') {
          if (Array.isArray(data.onlineUserIds)) {
            setOnlineUsers(new Set(data.onlineUserIds));
          }
        } else if (data.type === 'presence') {
          setOnlineUsers((prev) => {
            const next = new Set(prev);
            if (data.isOnline) {
              next.add(data.userId);
            } else {
              next.delete(data.userId);
            }
            return next;
          });
        } else if (data.type === 'clear_chat') {
          setMessages((prev) =>
            prev.filter(
              (m) =>
                !(
                  (m.fromUserId === currentUser.id && m.toUserId === data.contactId) ||
                  (m.fromUserId === data.contactId && m.toUserId === currentUser.id)
                )
            )
          );
        } else if (data.type === 'handshake_request' || data.type === 'handshake_accepted' || data.type === 'handshake_rejected') {
          fetchHandshakes();
          fetchContacts();
          if (data.type === 'handshake_request' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('🤝 Solicitud Familiar', {
              body: `${data.handshake?.fromGuardianName || 'Una madre'} solicita conectar a sus hijos.`,
              icon: '/favicon.svg'
            });
          }
        } else if (data.type === 'contact_added') {
          fetchContacts();
        }
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };

    // Presence update based on tab/app visibility (like WhatsApp)
    const handleVisibilityChange = () => {
      if (ws.readyState === WebSocket.OPEN && currentUser) {
        const isVisible = document.visibilityState === 'visible';
        ws.send(JSON.stringify({
          type: 'presence_state',
          isOnline: isVisible
        }));
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      ws.close();
    };
  }, [currentUser, userKeyPair]);

  const playNotificationSoundAndVibrate = () => {
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate([70, 40, 70]);
      }
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {}
  };

  // Automatically mark incoming messages from active contact as read
  useEffect(() => {
    if (!activeContact || !currentUser || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (document.visibilityState !== 'visible') return;

    const unreadIds = messages
      .filter((m) => m && m.fromUserId === activeContact.id && m.toUserId === currentUser.id && m.status !== 'read')
      .map((m) => m.id);

    if (unreadIds.length > 0) {
      wsRef.current.send(
        JSON.stringify({
          type: 'ack',
          messageIds: unreadIds,
          status: 'read'
        })
      );
      setMessages((prev) =>
        prev.map((m) =>
          m.fromUserId === activeContact.id && m.toUserId === currentUser.id ? { ...m, status: 'read' } : m
        )
      );
    }
  }, [activeContact?.id, messages.length]);

  // Decrypt incoming message
  const handleIncomingPacket = async (pkt: any) => {
    if (!userKeyPair) return;

    const isSender = pkt.fromUserId === currentUser.id;
    const isMirror = pkt.mirrorUserId === currentUser.id && pkt.toUserId !== currentUser.id && pkt.fromUserId !== currentUser.id;
    const keyToUse = isSender && pkt.encryptedForSender
      ? pkt.encryptedForSender
      : (isMirror && pkt.encryptedForMirror ? pkt.encryptedForMirror : pkt.encryptedForRecipient);

    let decryptedText = '';
    let decryptedMediaUrl: string | undefined = undefined;

    if (pkt.type === 'text') {
      decryptedText = await decryptTextMessage(
        pkt.ciphertext || pkt.encryptedForRecipient,
        pkt.iv,
        keyToUse,
        pkt.senderEphemeralKey || '',
        userKeyPair.privateKeyBase64,
        keyring
      );
    } else if (pkt.type === 'image' && pkt.mediaUrl) {
      try {
        decryptedMediaUrl = await decryptMediaBlob(
          `${API_BASE}${pkt.mediaUrl}`,
          keyToUse,
          pkt.iv,
          pkt.senderEphemeralKey || '',
          userKeyPair.privateKeyBase64,
          'image/jpeg',
          keyring
        );
      } catch (e) {
        console.warn('Failed to decrypt image:', e);
      }
    } else if (pkt.type === 'audio' && pkt.mediaUrl) {
      try {
        decryptedMediaUrl = await decryptMediaBlob(
          `${API_BASE}${pkt.mediaUrl}`,
          keyToUse,
          pkt.iv,
          pkt.senderEphemeralKey || '',
          userKeyPair.privateKeyBase64,
          pkt.mediaMimeType || 'audio/webm',
          keyring
        );
      } catch (e) {
        console.warn('Failed to decrypt audio:', e);
      }
    }

    const processedMsg = {
      ...pkt,
      decryptedText,
      decryptedMediaUrl
    };

    setMessages((prev) => {
      if (prev.some((m) => m.id === pkt.id)) return prev;
      return [...prev, processedMsg];
    });

    // Notify or mark as read
    if (!isSender && !isMirror) {
      const isViewingChat =
        activeContact &&
        activeContact.id === pkt.fromUserId &&
        document.visibilityState === 'visible';

      if (isViewingChat) {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'ack',
              messageId: pkt.id,
              status: 'read'
            })
          );
        }
      } else {
        playNotificationSoundAndVibrate();

        if ('Notification' in window && Notification.permission === 'granted') {
          const senderContact = contacts.find((c) => c.id === pkt.fromUserId);
          const senderName = senderContact?.username || 'Familiar';
          const preview =
            pkt.type === 'text'
              ? decryptedText || 'Nuevo mensaje'
              : pkt.type === 'image'
              ? '📸 Foto recibida'
              : '🎤 Nota de voz recibida';

          try {
            const notif = new Notification(`💬 ${senderName}`, {
              body: preview,
              icon: senderContact?.avatar || '/favicon.svg',
              tag: `family_chat_${pkt.fromUserId}`
            });
            notif.onclick = () => {
              window.focus();
              if (senderContact) {
                setActiveContact(senderContact);
              }
            };
          } catch (e) {
            console.error('Notification error:', e);
          }
        }
      }
    }
  };

  const handleIncomingEdit = async (pkt: any) => {
    if (!userKeyPair) return;
    const isSender = pkt.fromUserId === currentUser.id;
    const isMirror = pkt.mirrorUserId === currentUser.id && pkt.toUserId !== currentUser.id && pkt.fromUserId !== currentUser.id;
    const keyToUse = isSender && pkt.encryptedForSender
      ? pkt.encryptedForSender
      : (isMirror && pkt.encryptedForMirror ? pkt.encryptedForMirror : pkt.encryptedForRecipient);

    let decryptedText = '';
    if (pkt.type === 'text') {
      try {
        decryptedText = await decryptTextMessage(
          pkt.ciphertext || pkt.encryptedForRecipient,
          pkt.iv,
          keyToUse,
          pkt.senderEphemeralKey || '',
          userKeyPair.privateKeyBase64,
          keyring
        );
      } catch (e) {
        decryptedText = '🔒 [Mensaje editado]';
      }
    }

    setMessages((prev) =>
      prev.map((m) =>
        m.id === pkt.id
          ? {
              ...m,
              ...pkt,
              decryptedText,
              isEdited: true
            }
          : m
      )
    );
  };

  const fetchContacts = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE}/api/contacts/${currentUser.id}`);
      if (res.status === 404) {
        handleLogout();
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setContacts(data);
        if (currentUser.role === 'guardian') {
          const kids = data.filter((c: any) => c.guardianId === currentUser.id);
          setChildrenList(kids);
        }
      }
    } catch (e) {
      console.error('Error fetching contacts:', e);
    }
  };

  const fetchHandshakes = async () => {
    if (!currentUser || currentUser.role !== 'guardian') return;
    try {
      const res = await fetch(`${API_BASE}/api/guardian/handshakes/${currentUser.id}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setHandshakes(data);
      }
    } catch (e) {
      console.error('Error fetching handshakes:', e);
    }
  };

  const fetchMessages = async () => {
    if (!currentUser || !userKeyPair) return;
    try {
      const res = await fetch(`${API_BASE}/api/messages/${currentUser.id}`);
      if (!res.ok) return;
      const rawMessages = await res.json();
      if (!Array.isArray(rawMessages)) return;

      const decryptedList = await Promise.all(
        rawMessages.map(async (pkt) => {
          const isSender = pkt.fromUserId === currentUser.id;
          const isMirror = pkt.mirrorUserId === currentUser.id && pkt.toUserId !== currentUser.id && pkt.fromUserId !== currentUser.id;
          const keyToUse = isSender && pkt.encryptedForSender
            ? pkt.encryptedForSender
            : (isMirror && pkt.encryptedForMirror ? pkt.encryptedForMirror : pkt.encryptedForRecipient);

          let decryptedText = '';
          let decryptedMediaUrl: string | undefined = undefined;

          if (pkt.type === 'text') {
            decryptedText = await decryptTextMessage(
              pkt.ciphertext || pkt.encryptedForRecipient,
              pkt.iv,
              keyToUse,
              pkt.senderEphemeralKey || '',
              userKeyPair.privateKeyBase64,
              keyring
            );
          } else if (pkt.type === 'image' && pkt.mediaUrl) {
            try {
              decryptedMediaUrl = await decryptMediaBlob(
                `${API_BASE}${pkt.mediaUrl}`,
                keyToUse,
                pkt.iv,
                pkt.senderEphemeralKey || '',
                userKeyPair.privateKeyBase64,
                'image/jpeg',
                keyring
              );
            } catch (e) {
              console.warn('Image decryption error:', e);
            }
          } else if (pkt.type === 'audio' && pkt.mediaUrl) {
            try {
              decryptedMediaUrl = await decryptMediaBlob(
                `${API_BASE}${pkt.mediaUrl}`,
                keyToUse,
                pkt.iv,
                pkt.senderEphemeralKey || '',
                userKeyPair.privateKeyBase64,
                pkt.mediaMimeType || 'audio/webm',
                keyring
              );
            } catch (e) {
              console.warn('Audio decryption error:', e);
            }
          }

          return {
            ...pkt,
            decryptedText,
            decryptedMediaUrl
          };
        })
      );

      setMessages(decryptedList);
    } catch (e) {
      console.error('Error syncing message history:', e);
    }
  };

  // --- ACTIONS ---

  const handleSendMessage = async (text: string) => {
    if (!activeContact || !userKeyPair || !currentUser) return;

    try {
      let mirrorPublicKey: string | undefined = undefined;
      let mirrorUserId: string | undefined = undefined;

      // Mirror view is ONLY needed if chatting with someone OTHER than the guardian
      if (currentUser.role === 'kid' && currentUser.age < 10 && currentUser.guardianId) {
        if (activeContact.id !== currentUser.guardianId) {
          mirrorUserId = currentUser.guardianId;
          const gRes = await fetch(`${API_BASE}/api/users/${currentUser.guardianId}`);
          const gUser = await gRes.json();
          if (gUser.publicKey && gUser.publicKey.length < 60) {
            mirrorPublicKey = gUser.publicKey;
          }
        }
      } else if (activeContact.role === 'kid' && activeContact.age < 10 && activeContact.guardianId) {
        if (currentUser.id !== activeContact.guardianId) {
          mirrorUserId = activeContact.guardianId;
          const gRes = await fetch(`${API_BASE}/api/users/${activeContact.guardianId}`);
          const gUser = await gRes.json();
          if (gUser.publicKey && gUser.publicKey.length < 60) {
            mirrorPublicKey = gUser.publicKey;
          }
        }
      }

      let recipientPubKey = activeContact.publicKey;
      try {
        const uRes = await fetch(`${API_BASE}/api/users/${activeContact.id}`);
        const uData = await uRes.json();
        if (uData.publicKey && uData.publicKey.length < 60) {
          recipientPubKey = uData.publicKey;
        }
      } catch (e) {}

      const encrypted = await encryptTextMessage(
        text,
        recipientPubKey,
        mirrorPublicKey,
        userKeyPair.publicKeyBase64
      );

      const packet = {
        id: safeUUID(),
        fromUserId: currentUser.id,
        toUserId: activeContact.id,
        mirrorUserId,
        ciphertext: encrypted.ciphertext,
        encryptedForSender: encrypted.encryptedKeyForSender,
        encryptedForRecipient: encrypted.encryptedKeyForRecipient,
        encryptedForMirror: encrypted.encryptedKeyForMirror,
        senderEphemeralKey: encrypted.senderEphemeralKey,
        iv: encrypted.iv,
        type: 'text' as const,
        timestamp: Date.now(),
        status: 'sent' as const
      };

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'send_message',
            userId: currentUser.id,
            message: packet
          })
        );
      } else {
        await fetch(`${API_BASE}/api/messages/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: packet })
        });
      }

      setMessages((prev) => [
        ...prev,
        {
          ...packet,
          decryptedText: text
        }
      ]);
    } catch (err: any) {
      console.error('Error sending message:', err);
      alert(`Error enviando mensaje: ${err.message || err}`);
    }
  };

  const handleSendAudio = async (audioBlob: Blob, duration: number) => {
    if (!activeContact || !userKeyPair || !currentUser) return;

    try {
      let mirrorPublicKey: string | undefined = undefined;
      let mirrorUserId: string | undefined = undefined;

      if (currentUser.role === 'kid' && currentUser.age < 10 && currentUser.guardianId && activeContact.id !== currentUser.guardianId) {
        mirrorUserId = currentUser.guardianId;
        const gRes = await fetch(`${API_BASE}/api/users/${currentUser.guardianId}`);
        const gUser = await gRes.json();
        if (gUser.publicKey && gUser.publicKey.length < 60) mirrorPublicKey = gUser.publicKey;
      } else if (activeContact.role === 'kid' && activeContact.age < 10 && activeContact.guardianId && currentUser.id !== activeContact.guardianId) {
        mirrorUserId = activeContact.guardianId;
        const gRes = await fetch(`${API_BASE}/api/users/${activeContact.guardianId}`);
        const gUser = await gRes.json();
        if (gUser.publicKey && gUser.publicKey.length < 60) mirrorPublicKey = gUser.publicKey;
      }

      let recipientPubKey = activeContact.publicKey;
      try {
        const uRes = await fetch(`${API_BASE}/api/users/${activeContact.id}`);
        const uData = await uRes.json();
        if (uData.publicKey && uData.publicKey.length < 60) {
          recipientPubKey = uData.publicKey;
        }
      } catch (e) {}

      const enc = await encryptMediaBlob(
        audioBlob,
        recipientPubKey,
        mirrorPublicKey,
        userKeyPair.publicKeyBase64
      );

      const formData = new FormData();
      formData.append('blob', enc.encryptedBlob, 'encrypted_voice.bin');

      const uploadRes = await fetch(`${API_BASE}/api/media/upload`, {
        method: 'POST',
        body: formData
      });
      const uploadData = await uploadRes.json();

      const packet = {
        id: safeUUID(),
        fromUserId: currentUser.id,
        toUserId: activeContact.id,
        mirrorUserId,
        encryptedForSender: enc.encryptedKeyForSender,
        encryptedForRecipient: enc.encryptedKeyForRecipient,
        encryptedForMirror: enc.encryptedKeyForMirror,
        senderEphemeralKey: enc.senderEphemeralKey,
        iv: enc.iv,
        type: 'audio' as const,
        mediaUrl: uploadData.mediaUrl,
        mediaMimeType: audioBlob.type || 'audio/webm',
        mediaDuration: duration,
        timestamp: Date.now(),
        status: 'sent' as const
      };

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'send_message',
            userId: currentUser.id,
            message: packet
          })
        );
      } else {
        await fetch(`${API_BASE}/api/messages/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: packet })
        });
      }

      setMessages((prev) => [
        ...prev,
        {
          ...packet,
          decryptedMediaUrl: URL.createObjectURL(audioBlob)
        }
      ]);
    } catch (err: any) {
      console.error('Error sending audio:', err);
      alert(`Error enviando nota de voz: ${err.message || err}`);
    }
  };

  const handleSendPhoto = async (photoBlob: Blob, isProtected: boolean = false) => {
    if (!activeContact || !userKeyPair || !currentUser) return;

    try {
      let mirrorPublicKey: string | undefined = undefined;
      let mirrorUserId: string | undefined = undefined;

      if (currentUser.role === 'kid' && currentUser.age < 10 && currentUser.guardianId && activeContact.id !== currentUser.guardianId) {
        mirrorUserId = currentUser.guardianId;
        const gRes = await fetch(`${API_BASE}/api/users/${currentUser.guardianId}`);
        const gUser = await gRes.json();
        if (gUser.publicKey && gUser.publicKey.length < 60) mirrorPublicKey = gUser.publicKey;
      } else if (activeContact.role === 'kid' && activeContact.age < 10 && activeContact.guardianId && currentUser.id !== activeContact.guardianId) {
        mirrorUserId = activeContact.guardianId;
        const gRes = await fetch(`${API_BASE}/api/users/${activeContact.guardianId}`);
        const gUser = await gRes.json();
        if (gUser.publicKey && gUser.publicKey.length < 60) mirrorPublicKey = gUser.publicKey;
      }

      let recipientPubKey = activeContact.publicKey;
      try {
        const uRes = await fetch(`${API_BASE}/api/users/${activeContact.id}`);
        const uData = await uRes.json();
        if (uData.publicKey && uData.publicKey.length < 60) {
          recipientPubKey = uData.publicKey;
        }
      } catch (e) {}

      const enc = await encryptMediaBlob(
        photoBlob,
        recipientPubKey,
        mirrorPublicKey,
        userKeyPair.publicKeyBase64
      );

      const formData = new FormData();
      formData.append('blob', enc.encryptedBlob, 'encrypted_photo.bin');

      const uploadRes = await fetch(`${API_BASE}/api/media/upload`, {
        method: 'POST',
        body: formData
      });
      const uploadData = await uploadRes.json();

      const packet = {
        id: safeUUID(),
        fromUserId: currentUser.id,
        toUserId: activeContact.id,
        mirrorUserId,
        encryptedForSender: enc.encryptedKeyForSender,
        encryptedForRecipient: enc.encryptedKeyForRecipient,
        encryptedForMirror: enc.encryptedKeyForMirror,
        senderEphemeralKey: enc.senderEphemeralKey,
        iv: enc.iv,
        type: 'image' as const,
        mediaUrl: uploadData.mediaUrl,
        timestamp: Date.now(),
        status: 'sent' as const,
        isProtected: !!isProtected
      };

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'send_message',
            userId: currentUser.id,
            message: packet
          })
        );
      } else {
        await fetch(`${API_BASE}/api/messages/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: packet })
        });
      }

      setMessages((prev) => [
        ...prev,
        {
          ...packet,
          decryptedMediaUrl: URL.createObjectURL(photoBlob),
          isProtected: !!isProtected
        }
      ]);
    } catch (err: any) {
      console.error('Error sending photo:', err);
      alert(`Error enviando foto: ${err.message || err}`);
    }
  };

  const isMinor = currentUser?.role === 'kid' || currentUser?.role === 'teen';

  const executeWithGuardianPin = (action: () => void, title?: string, description?: string) => {
    if (isMinor) {
      setPinModalTitle(title || 'Autorización de Guardián Requerida');
      setPinModalDesc(description || 'Para proteger a los menores, esta acción requiere el PIN de tus padres.');
      setPendingAction(() => action);
      setShowPinModal(true);
    } else {
      action();
    }
  };

  const executeWithPinPrompt = (action: () => void, title?: string, description?: string, forcePin: boolean = false) => {
    if (isMinor || forcePin) {
      setPinModalTitle(title || 'Autorización de Seguridad Requerida');
      setPinModalDesc(description || 'Esta acción requiere el PIN de seguridad.');
      setPendingAction(() => action);
      setShowPinModal(true);
    } else {
      action();
    }
  };

  const handleUnlockProtectedPhoto = (msgId: string) => {
    executeWithPinPrompt(
      () => {
        setUnlockedProtectedPhotos((prev) => [...prev, msgId]);
      },
      'Desbloquear Foto Protegida',
      'Ingresa el PIN de Guardián (1234) para ver esta foto sensible o documento familiar.',
      true
    );
  };

  const handleDeleteChatPhotos = async (
    contactId: string,
    mode: 'for_me' | 'for_everyone' = 'for_me',
    guardianAuthorized: boolean = false
  ) => {
    if (isMinor && !guardianAuthorized) {
      executeWithGuardianPin(
        () => handleDeleteChatPhotos(contactId, mode, true),
        'Autorización para Vaciar Fotos',
        'En cuentas de menores, vaciar las fotos del chat requiere el PIN de tus padres.'
      );
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/messages/delete-photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          contactId,
          requestedByUserId: currentUser.id,
          mode,
          guardianAuthorized
        })
      });
      const data = await res.json();
      if (data.success && data.deletedIds) {
        const deletedSet = new Set(data.deletedIds);
        setMessages((prev) => prev.filter((m) => !deletedSet.has(m.id)));
      } else if (data.error) {
        alert(data.error);
      }
    } catch (e: any) {
      alert('Error vaciando fotos de la conversación.');
    }
  };

  const handleDeleteMessage = async (
    msgId: string,
    mode: 'for_me' | 'for_everyone' = 'for_everyone',
    guardianAuthorized: boolean = false
  ) => {
    if (isMinor && !guardianAuthorized) {
      executeWithGuardianPin(
        () => handleDeleteMessage(msgId, mode, true),
        'Autorización para Eliminar Mensaje',
        'En cuentas de menores, eliminar mensajes (para ti o para todos) requiere el PIN de guardián.'
      );
      return;
    }

    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'delete_message',
            messageId: msgId,
            mode,
            guardianAuthorized
          })
        );
      }

      const res = await fetch(`${API_BASE}/api/messages/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: msgId,
          requestedByUserId: currentUser.id,
          mode,
          guardianAuthorized
        })
      });
      const data = await res.json();
      if (data.success) {
        setMessages((prev) => prev.filter((m) => m.id !== msgId));
      } else {
        alert(data.error);
      }
    } catch (e: any) {
      alert('Error eliminando mensaje.');
    }
  };

  const handleEditMessage = async (
    msgId: string,
    newText: string,
    guardianAuthorized: boolean = false
  ) => {
    if (isMinor && !guardianAuthorized) {
      executeWithGuardianPin(
        () => handleEditMessage(msgId, newText, true),
        'Autorización para Editar Mensaje',
        'En cuentas de menores, modificar mensajes enviados requiere el PIN de tus padres.'
      );
      return;
    }

    if (!userKeyPair || !currentUser) return;

    try {
      const msg = messages.find((m) => m.id === msgId);
      const recipientId = msg?.toUserId === currentUser.id ? msg.fromUserId : (msg?.toUserId || activeContact?.id);
      if (!recipientId) return;

      let recipientPubKey = activeContact?.publicKey;
      let mirrorPubKey: string | undefined = undefined;

      try {
        const uRes = await fetch(`${API_BASE}/api/users/${recipientId}`);
        const uData = await uRes.json();
        if (uData.publicKey && uData.publicKey.length < 60) {
          recipientPubKey = uData.publicKey;
        }
        if (uData.role === 'kid' && uData.guardianId) {
          const gRes = await fetch(`${API_BASE}/api/users/${uData.guardianId}`);
          const gData = await gRes.json();
          if (gData.publicKey && gData.publicKey.length < 60) mirrorPubKey = gData.publicKey;
        }
      } catch (e) {}

      if (currentUser.role === 'kid' && currentUser.guardianId) {
        try {
          const gRes = await fetch(`${API_BASE}/api/users/${currentUser.guardianId}`);
          const gData = await gRes.json();
          if (gData.publicKey && gData.publicKey.length < 60) mirrorPubKey = gData.publicKey;
        } catch (e) {}
      }

      const enc = await encryptTextMessage(
        newText,
        recipientPubKey || userKeyPair.publicKeyBase64,
        mirrorPubKey,
        userKeyPair.publicKeyBase64
      );

      const updatedFields = {
        ciphertext: enc.ciphertext,
        encryptedForSender: enc.encryptedKeyForSender,
        encryptedForRecipient: enc.encryptedKeyForRecipient,
        encryptedForMirror: enc.encryptedKeyForMirror,
        senderEphemeralKey: enc.senderEphemeralKey,
        iv: enc.iv
      };

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'edit_message',
            messageId: msgId,
            message: updatedFields,
            guardianAuthorized
          })
        );
      }

      const res = await fetch(`${API_BASE}/api/messages/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: msgId,
          updatedFields,
          requestedByUserId: currentUser.id,
          guardianAuthorized
        })
      });
      const data = await res.json();
      if (data.success) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? {
                  ...m,
                  ...updatedFields,
                  decryptedText: newText,
                  isEdited: true
                }
              : m
          )
        );
      } else {
        alert(data.error);
      }
    } catch (e: any) {
      alert(`Error editando mensaje: ${e.message || e}`);
    }
  };

  const handleClearChat = async (
    contactId: string,
    mode: 'for_me' | 'for_everyone' = 'for_me',
    guardianAuthorized: boolean = false
  ) => {
    if (isMinor && !guardianAuthorized) {
      executeWithGuardianPin(
        () => handleClearChat(contactId, mode, true),
        'Autorización para Vaciar Conversación',
        'En cuentas de menores, vaciar o limpiar el chat requiere el PIN de tus padres.'
      );
      return;
    }

    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'clear_chat',
            contactId,
            mode,
            guardianAuthorized
          })
        );
      }

      const res = await fetch(`${API_BASE}/api/messages/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          contactId,
          requestedByUserId: currentUser.id,
          mode,
          guardianAuthorized
        })
      });
      const data = await res.json();
      if (data.success) {
        setMessages((prev) =>
          prev.filter(
            (m) =>
              !(
                (m.fromUserId === currentUser.id && m.toUserId === contactId) ||
                (m.fromUserId === contactId && m.toUserId === currentUser.id)
              )
          )
        );
      } else {
        alert(data.error);
      }
    } catch (e: any) {
      alert('Error limpiando conversación.');
    }
  };

  // --- AUTHENTICATION ---

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setRawAvatarToCrop(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      if (authMode === 'register') {
        if (!emailInput.trim() || !/\S+@\S+\.\S+/.test(emailInput)) {
          throw new Error('Por favor ingresa un correo electrónico válido para tu cuenta de Guardián.');
        }

        const pwdError = validatePassword(passwordInput);
        if (pwdError) {
          throw new Error(pwdError);
        }

        // Deterministic Zero-Knowledge Key Derivation
        const keyPair = await deriveDeterministicKeyPair(
          usernameInput.trim(),
          passwordInput.trim(),
          usernameInput.trim()
        );

        const res = await fetch(`${API_BASE}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: usernameInput.trim(),
            email: emailInput.trim(),
            password: passwordInput.trim(),
            role: 'guardian',
            age: 35,
            publicKey: keyPair.publicKeyBase64
          })
        });

        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error);
        }

        localStorage.setItem('family_chat_user', JSON.stringify(data.user));
        localStorage.setItem('family_chat_privkey', keyPair.privateKeyBase64);
        localStorage.setItem('family_chat_pubkey', keyPair.publicKeyBase64);

        setCurrentUser(data.user);
        setUserKeyPair(keyPair);
      } else {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: usernameInput.trim(),
            password: passwordInput.trim() || undefined
          })
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error);
        }

        // Derive permanent deterministic sovereign key from credentials + userId
        const keyPair = await deriveDeterministicKeyPair(
          data.user.username,
          passwordInput.trim() || '',
          data.user.id
        );

        // Preserve any previous key into keyring so older messages can always decrypt
        const savedPriv = localStorage.getItem('family_chat_privkey');
        const existingKeyring: string[] = JSON.parse(localStorage.getItem('family_chat_keyring') || '[]');
        if (savedPriv && !existingKeyring.includes(savedPriv) && savedPriv !== keyPair.privateKeyBase64) {
          existingKeyring.push(savedPriv);
          localStorage.setItem('family_chat_keyring', JSON.stringify(existingKeyring));
          setKeyring(existingKeyring);
        }

        localStorage.setItem('family_chat_user', JSON.stringify(data.user));
        localStorage.setItem('family_chat_privkey', keyPair.privateKeyBase64);
        localStorage.setItem('family_chat_pubkey', keyPair.publicKeyBase64);

        // Always sync true deterministic public key to server
        fetch(`${API_BASE}/api/users/${data.user.id}/public-key`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicKey: keyPair.publicKeyBase64 })
        }).catch(console.error);

        setCurrentUser(data.user);
        setUserKeyPair(keyPair);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Error de autenticación.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('family_chat_user');
    localStorage.removeItem('family_chat_privkey');
    localStorage.removeItem('family_chat_pubkey');
    setCurrentUser(null);
    setUserKeyPair(null);
    setActiveContact(null);
    setMessages([]);
    setPasswordInput('');
    setEmailInput('');
    setAvatarPreview(null);
  };

  const handleUserUpdated = (updatedUser: any) => {
    setCurrentUser(updatedUser);
    localStorage.setItem('family_chat_user', JSON.stringify(updatedUser));
  };

  const activeChatMessages = messages.filter(
    (m) =>
      (m.fromUserId === currentUser?.id && m.toUserId === activeContact?.id) ||
      (m.fromUserId === activeContact?.id && m.toUserId === currentUser?.id)
  );

  const mirrorMessages = messages.filter(
    (m) => m.mirrorUserId === currentUser?.id && m.fromUserId !== currentUser?.id && m.toUserId !== currentUser?.id
  );

  if (!currentUser) {
    const defaultAvatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(usernameInput.trim() || 'Familiar')}`;
    const displayAvatar = avatarPreview || defaultAvatarUrl;

    return (
      <div className="min-h-screen min-h-[100dvh] bg-slate-950 text-white flex items-center justify-center p-4 overflow-y-auto">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl my-auto">
          <div className="text-center mb-6">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 mb-3 shadow-lg">
              <Shield className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">Plataforma Familiar Segura</h1>
            <p className="text-xs text-slate-400 mt-1">
              Cifrado E2EE sin número telefónico • Contacto protegido por invitación
            </p>
          </div>

          <div className="flex bg-slate-800/80 p-1 rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => { setAuthMode('register'); setAuthError(null); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                authMode === 'register' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Crear Cuenta
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('login'); setAuthError(null); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                authMode === 'login' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Iniciar Sesión
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-400" /> Nombre de Usuario (Sin teléfono)
              </label>
              <input
                type="text"
                required
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="ej: papa, mama, maverick"
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            {authMode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-indigo-400" /> Correo Electrónico
                </label>
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="tu.correo@ejemplo.com"
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Para recuperación de cuenta y avisos de seguridad familiar.
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-indigo-400" /> Contraseña
              </label>
              <input
                type="password"
                required={authMode === 'register'}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder={authMode === 'register' ? 'Crea una contraseña segura' : 'Tu contraseña (si aplica)'}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
              />

              {authMode === 'register' && (
                <div className="mt-2 p-2.5 bg-slate-800/60 rounded-xl border border-slate-700/60 text-[11px] space-y-1">
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">Requisitos de contraseña:</span>
                  <div className="grid grid-cols-2 gap-1 text-[11px]">
                    <span className={passwordInput.length >= 8 ? 'text-emerald-400 font-medium' : 'text-slate-400'}>
                      {passwordInput.length >= 8 ? '✓' : '•'} Mínimo 8 caracteres
                    </span>
                    <span className={/[A-Z]/.test(passwordInput) ? 'text-emerald-400 font-medium' : 'text-slate-400'}>
                      {/[A-Z]/.test(passwordInput) ? '✓' : '•'} Una mayúscula
                    </span>
                    <span className={/[a-z]/.test(passwordInput) ? 'text-emerald-400 font-medium' : 'text-slate-400'}>
                      {/[a-z]/.test(passwordInput) ? '✓' : '•'} Una minúscula
                    </span>
                    <span className={/[^A-Za-z0-9]/.test(passwordInput) ? 'text-emerald-400 font-medium' : 'text-slate-400'}>
                      {/[^A-Za-z0-9]/.test(passwordInput) ? '✓' : '•'} Un signo (!@#$...)
                    </span>
                  </div>
                </div>
              )}
            </div>

            {authError && (
              <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-red-400 text-xs">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 mt-4 active:scale-98"
            >
              {authLoading ? 'Generando Criptografía...' : authMode === 'login' ? 'Entrar al Chat' : 'Crear Cuenta Segura'}
            </button>
          </form>
        </div>

        {rawAvatarToCrop && (
          <AvatarCropperModal
            isOpen={!!rawAvatarToCrop}
            imageSrc={rawAvatarToCrop}
            onClose={() => setRawAvatarToCrop(null)}
            onCropComplete={(cropped) => {
              setAvatarPreview(cropped);
              setRawAvatarToCrop(null);
            }}
          />
        )}
      </div>
    );
  }

  // SISTER APP: FAMILY PHOTOS VAULT
  if (currentTab === 'photos') {
    return (
      <>
        <FamilyPhotosVault
          currentUser={currentUser}
          contacts={contacts}
          messages={messages}
          onBackToChat={() => setCurrentTab('chat')}
          onDeleteMessage={handleDeleteMessage}
          onDeleteChatPhotos={handleDeleteChatPhotos}
          onRequestPinUnlock={(callback, title, description) =>
            executeWithPinPrompt(callback, title, description, true)
          }
        />
        <ParentPinModal
          isOpen={showPinModal}
          onClose={() => {
            setShowPinModal(false);
            setPendingAction(null);
          }}
          onSuccess={() => {
            if (pendingAction) {
              const act = pendingAction;
              setPendingAction(null);
              act();
            }
          }}
          title={pinModalTitle}
          description={pinModalDesc}
        />
      </>
    );
  }

  // 1. KIDS EXPERIENCE (< 10)
  if (currentUser.role === 'kid' || (currentUser.age && currentUser.age < 10)) {
    return (
      <>
        <KidsView
          currentUser={currentUser}
          contacts={contacts}
          activeContact={activeContact}
          onSelectContact={setActiveContact}
          onBackToContacts={() => setActiveContact(null)}
          messages={activeChatMessages}
          onSendMessage={handleSendMessage}
          onSendAudio={handleSendAudio}
          onSendPhoto={handleSendPhoto}
          onDeleteMessage={handleDeleteMessage}
          onEditMessage={handleEditMessage}
          onClearChat={handleClearChat}
          onLogout={handleLogout}
          onOpenPhotosVault={() => setCurrentTab('photos')}
          onOpenSettings={() => {
            executeWithPinPrompt(
              () => setShowSettingsModal(true),
              'Ajustes Protegidos por Guardián',
              'Para proteger a los menores, el acceso a los ajustes requiere el PIN de tus padres.',
              true
            );
          }}
          unlockedProtectedPhotos={unlockedProtectedPhotos}
          onUnlockProtectedPhoto={handleUnlockProtectedPhoto}
          onUserUpdated={handleUserUpdated}
          onlineUsers={onlineUsers}
        />
        <ParentPinModal
          isOpen={showPinModal}
          onClose={() => { setShowPinModal(false); setPendingAction(null); }}
          onSuccess={() => {
            if (pendingAction) {
              const act = pendingAction;
              setPendingAction(null);
              act();
            }
          }}
          title={pinModalTitle}
          description={pinModalDesc}
        />
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          currentUser={currentUser}
          currentEnvironment={currentEnvironment}
          onSelectEnvironment={(env) => setCurrentEnvironment(env)}
          onLogout={handleLogout}
        />
      </>
    );
  }

  // 2. TEENS EXPERIENCE (10 - 17)
  if (currentUser.role === 'teen' || (currentUser.age && currentUser.age >= 10 && currentUser.age < 18)) {
    return (
      <>
        <TeensView
          currentUser={currentUser}
          contacts={contacts}
          activeContact={activeContact}
          onSelectContact={setActiveContact}
          onBackToContacts={() => setActiveContact(null)}
          messages={activeChatMessages}
          onSendMessage={handleSendMessage}
          onSendAudio={handleSendAudio}
          onSendPhoto={handleSendPhoto}
          onDeleteMessage={handleDeleteMessage}
          onEditMessage={handleEditMessage}
          onClearChat={handleClearChat}
          onLogout={handleLogout}
          onOpenPhotosVault={() => setCurrentTab('photos')}
          onOpenSettings={() => {
            executeWithPinPrompt(
              () => setShowSettingsModal(true),
              'Ajustes Protegidos por Guardián',
              'Para proteger a los menores, el acceso a los ajustes requiere el PIN de tus padres.',
              true
            );
          }}
          unlockedProtectedPhotos={unlockedProtectedPhotos}
          onUnlockProtectedPhoto={handleUnlockProtectedPhoto}
          onUserUpdated={handleUserUpdated}
          onlineUsers={onlineUsers}
        />

        <ParentPinModal
          isOpen={showPinModal}
          onClose={() => { setShowPinModal(false); setPendingAction(null); }}
          onSuccess={() => {
            if (pendingAction) {
              const act = pendingAction;
              setPendingAction(null);
              act();
            }
          }}
          title={pinModalTitle}
          description={pinModalDesc}
        />
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          currentUser={currentUser}
          currentEnvironment={currentEnvironment}
          onSelectEnvironment={(env) => setCurrentEnvironment(env)}
          onLogout={handleLogout}
        />
      </>
    );
  }

  // 3. ADULTS / GUARDIAN EXPERIENCE
  return (
    <>
      <AdultsView
        currentUser={currentUser}
        contacts={contacts}
        activeContact={activeContact}
        onSelectContact={setActiveContact}
        onBackToContacts={() => setActiveContact(null)}
        messages={activeChatMessages}
        mirrorMessages={mirrorMessages}
        childrenList={childrenList}
        onSendMessage={handleSendMessage}
        onSendAudio={handleSendAudio}
        onSendPhoto={handleSendPhoto}
        onDeleteMessage={handleDeleteMessage}
        onEditMessage={handleEditMessage}
        onClearChat={handleClearChat}
        onOpenInviteModal={() => setShowInviteModal(true)}
        onLogout={handleLogout}
        onOpenPhotosVault={() => setCurrentTab('photos')}
        onOpenSettings={() => setShowSettingsModal(true)}
        handshakes={handshakes}
        onRefreshHandshakes={fetchHandshakes}
        unlockedProtectedPhotos={unlockedProtectedPhotos}
        onUnlockProtectedPhoto={handleUnlockProtectedPhoto}
        onUserUpdated={handleUserUpdated}
        onRefreshContacts={fetchContacts}
        onlineUsers={onlineUsers}
      />

      <InviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        currentUserId={currentUser.id}
        isGuardian={currentUser.role === 'guardian'}
        childrenList={childrenList}
        onInvitationAccepted={fetchContacts}
      />

      <ParentPinModal
        isOpen={showPinModal}
        onClose={() => { setShowPinModal(false); setPendingAction(null); }}
        onSuccess={() => {
          if (pendingAction) {
            const act = pendingAction;
            setPendingAction(null);
            act();
          }
        }}
        title={pinModalTitle}
        description={pinModalDesc}
      />

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        currentUser={currentUser}
        currentEnvironment={currentEnvironment}
        onSelectEnvironment={(env) => setCurrentEnvironment(env)}
        onLogout={handleLogout}
      />
    </>
  );
}

export default App;
