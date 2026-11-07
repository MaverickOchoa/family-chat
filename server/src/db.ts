import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { UserProfile, ApprovedContact, PairingInvitation, EncryptedMessagePacket } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const STORAGE_DIR = path.join(DATA_DIR, 'encrypted_blobs');

interface DatabaseSchema {
  users: Record<string, UserProfile>;
  contacts: ApprovedContact[];
  invitations: Record<string, PairingInvitation>;
  messages: EncryptedMessagePacket[];
}

class Database {
  private data: DatabaseSchema = {
    users: {},
    contacts: [],
    invitations: {},
    messages: []
  };

  constructor() {
    this.init();
  }

  private init() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
      } catch (err) {
        console.error('Failed to parse database file, initializing empty state:', err);
        this.save();
      }
    } else {
      this.save();
    }
  }

  private save() {
    try {
      const tempFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempFile, DB_FILE);
    } catch (err) {
      console.error('Failed to persist database:', err);
    }
  }

  // Users
  getUser(id: string): UserProfile | undefined {
    return this.data.users[id];
  }

  getUserByUsername(username: string): UserProfile | undefined {
    const clean = username.trim().toLowerCase();
    return Object.values(this.data.users).find(u => u.username.toLowerCase() === clean);
  }

  createUser(user: UserProfile): UserProfile {
    this.data.users[user.id] = user;
    this.save();
    return user;
  }

  getAllUsers(): UserProfile[] {
    return Object.values(this.data.users);
  }

  // Ghost Mode: Exclude minors from search
  searchPublicUsers(query: string): UserProfile[] {
    const q = query.trim().toLowerCase();
    return Object.values(this.data.users).filter(u => {
      // Minors are in GHOST MODE (cannot be discovered via search)
      if (u.role === 'kid' || u.role === 'teen') {
        return false;
      }
      return u.username.toLowerCase().includes(q);
    });
  }

  // Contacts
  getContacts(userId: string): ApprovedContact[] {
    return this.data.contacts.filter(c => c.userId === userId || c.contactId === userId);
  }

  areContacts(userA: string, userB: string): boolean {
    return this.data.contacts.some(
      c => (c.userId === userA && c.contactId === userB) ||
           (c.userId === userB && c.contactId === userA)
    );
  }

  addContact(userId: string, contactId: string, approvedByGuardianId?: string): ApprovedContact {
    if (this.areContacts(userId, contactId)) {
      return this.data.contacts.find(
        c => (c.userId === userId && c.contactId === contactId) ||
             (c.userId === contactId && c.contactId === userId)
      )!;
    }
    const newContact: ApprovedContact = {
      id: crypto.randomUUID(),
      userId,
      contactId,
      approvedByGuardianId,
      createdAt: new Date().toISOString()
    };
    this.data.contacts.push(newContact);
    this.save();
    return newContact;
  }

  // Invitations
  createInvitation(inv: PairingInvitation): PairingInvitation {
    this.data.invitations[inv.token] = inv;
    this.save();
    return inv;
  }

  getInvitation(token: string): PairingInvitation | undefined {
    return this.data.invitations[token];
  }

  useInvitation(token: string): boolean {
    const inv = this.data.invitations[token];
    if (!inv || inv.used || inv.expiresAt < Date.now()) {
      return false;
    }
    inv.used = true;
    this.save();
    return true;
  }

  // Messages (Blind Relay & Offline Sync)
  saveMessage(msg: EncryptedMessagePacket): EncryptedMessagePacket {
    this.data.messages.push(msg);
    this.save();
    return msg;
  }

  getMessagesForUser(userId: string): EncryptedMessagePacket[] {
    // Return messages where user is sender, recipient, or mirror (for parent audit of kid < 10)
    // Exclude messages hidden by this user ("eliminar para mí")
    return this.data.messages.filter(
      m => (m.fromUserId === userId || m.toUserId === userId || m.mirrorUserId === userId) &&
           (!m.hiddenForUserIds || !m.hiddenForUserIds.includes(userId))
    );
  }

  updateMessageStatus(messageId: string, status: 'delivered' | 'read'): boolean {
    const msg = this.data.messages.find(m => m.id === messageId);
    if (msg) {
      msg.status = status;
      this.save();
      return true;
    }
    return false;
  }

  deleteMessage(
    messageId: string,
    requestedByUserId: string,
    mode: 'for_me' | 'for_everyone' = 'for_everyone',
    guardianAuthorized: boolean = false
  ): { success: boolean; reason?: string; mode: 'for_me' | 'for_everyone'; message?: EncryptedMessagePacket } {
    const msgIndex = this.data.messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) {
      return { success: false, reason: 'Mensaje no encontrado.', mode };
    }

    const msg = this.data.messages[msgIndex];
    const sender = this.data.users[msg.fromUserId];
    const recipient = this.data.users[msg.toUserId];
    const requester = this.data.users[requestedByUserId];

    const senderIsMinor = sender && (sender.role === 'kid' || sender.role === 'teen' || (sender.age !== undefined && sender.age < 18));
    const recipientIsMinor = recipient && (recipient.role === 'kid' || recipient.role === 'teen' || (recipient.age !== undefined && recipient.age < 18));
    const involvesMinor = senderIsMinor || recipientIsMinor;

    const legalGuardianId = senderIsMinor ? sender?.guardianId : recipient?.guardianId;
    const isLegalGuardian = requestedByUserId === legalGuardianId || (requester?.role === 'guardian' && !legalGuardianId);

    // STRICT GOVERNANCE RULES FOR ANY MINOR (<18):
    if (involvesMinor) {
      if (mode === 'for_everyone') {
        // ONLY the minor's specific legal guardian or guardian authorized by PIN can delete for everyone
        if (!isLegalGuardian && !guardianAuthorized) {
          return {
            success: false,
            reason: 'Política de protección infantil: Los mensajes en conversaciones con menores (<18 años) no pueden ser destruidos para todos por familiares externos. Solo su tutor legal registrado puede autorizar el borrado total.',
            mode
          };
        }
      } else {
        // mode === 'for_me':
        // If the requester is the minor themselves, they require Guardian PIN authorization
        const requesterIsMinor = requester && (requester.role === 'kid' || requester.role === 'teen' || (requester.age !== undefined && requester.age < 18));
        if (requesterIsMinor && !guardianAuthorized) {
          return {
            success: false,
            reason: 'Política de protección infantil: En cuentas de menores, ocultar o eliminar mensajes requiere el PIN de guardián.',
            mode
          };
        }
        // If the requester is an external adult (e.g. Abu), they CAN delete for themselves without affecting the minor's history
      }
    }

    if (mode === 'for_me') {
      msg.hiddenForUserIds = msg.hiddenForUserIds || [];
      if (!msg.hiddenForUserIds.includes(requestedByUserId)) {
        msg.hiddenForUserIds.push(requestedByUserId);
      }
      this.save();
      return { success: true, mode: 'for_me', message: msg };
    }

    // Delete for everyone
    if (msg.mediaUrl) {
      const fileName = path.basename(msg.mediaUrl);
      const filePath = path.join(STORAGE_DIR, fileName);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.warn('Failed to delete media blob:', e);
        }
      }
    }

    const deleted = this.data.messages.splice(msgIndex, 1)[0];
    this.save();
    return { success: true, mode: 'for_everyone', message: deleted };
  }

  editMessage(
    messageId: string,
    updatedFields: Partial<EncryptedMessagePacket>,
    requestedByUserId: string,
    guardianAuthorized: boolean = false
  ): { success: boolean; reason?: string; message?: EncryptedMessagePacket } {
    const msg = this.data.messages.find(m => m.id === messageId);
    if (!msg) {
      return { success: false, reason: 'Mensaje no encontrado.' };
    }

    const sender = this.data.users[msg.fromUserId];
    const requester = this.data.users[requestedByUserId];

    if (msg.fromUserId !== requestedByUserId && requester?.role !== 'guardian') {
      return { success: false, reason: 'Solo el autor o el guardián pueden editar este mensaje.' };
    }

    const senderIsMinor = sender && (sender.role === 'kid' || sender.role === 'teen' || (sender.age !== undefined && sender.age < 18));
    if (senderIsMinor && !guardianAuthorized && requester?.role !== 'guardian') {
      return { success: false, reason: 'Política de protección infantil: En cuentas de menores (<18 años), editar mensajes requiere el PIN de guardián.' };
    }

    if (updatedFields.ciphertext) msg.ciphertext = updatedFields.ciphertext;
    if (updatedFields.encryptedForSender) msg.encryptedForSender = updatedFields.encryptedForSender;
    if (updatedFields.encryptedForRecipient) msg.encryptedForRecipient = updatedFields.encryptedForRecipient;
    if (updatedFields.encryptedForMirror) msg.encryptedForMirror = updatedFields.encryptedForMirror;
    if (updatedFields.senderEphemeralKey) msg.senderEphemeralKey = updatedFields.senderEphemeralKey;
    if (updatedFields.iv) msg.iv = updatedFields.iv;

    msg.isEdited = true;
    msg.editedAt = Date.now();
    this.save();

    return { success: true, message: msg };
  }

  clearChat(
    userId: string,
    contactId: string,
    requestedByUserId: string,
    mode: 'for_me' | 'for_everyone' = 'for_me',
    guardianAuthorized: boolean = false
  ): { success: boolean; reason?: string; mode: 'for_me' | 'for_everyone'; clearedCount: number } {
    const userA = this.data.users[userId];
    const userB = this.data.users[contactId];
    const requester = this.data.users[requestedByUserId];

    const aIsMinor = userA && (userA.role === 'kid' || userA.role === 'teen' || (userA.age !== undefined && userA.age < 18));
    const bIsMinor = userB && (userB.role === 'kid' || userB.role === 'teen' || (userB.age !== undefined && userB.age < 18));
    const involvesMinor = aIsMinor || bIsMinor;

    const legalGuardianId = aIsMinor ? userA?.guardianId : userB?.guardianId;
    const isLegalGuardian = requestedByUserId === legalGuardianId || (requester?.role === 'guardian' && !legalGuardianId);

    if (involvesMinor) {
      if (mode === 'for_everyone') {
        if (!isLegalGuardian && !guardianAuthorized) {
          return {
            success: false,
            reason: 'Política de protección infantil: Vaciar el chat para todos en conversaciones con menores (<18 años) está restringido a su tutor legal registrado.',
            mode,
            clearedCount: 0
          };
        }
      } else {
        const requesterIsMinor = requester && (requester.role === 'kid' || requester.role === 'teen' || (requester.age !== undefined && requester.age < 18));
        if (requesterIsMinor && !guardianAuthorized) {
          return {
            success: false,
            reason: 'Política de protección infantil: En cuentas de menores, vaciar la conversación requiere el PIN de guardián.',
            mode,
            clearedCount: 0
          };
        }
      }
    }

    let count = 0;
    if (mode === 'for_me') {
      for (const m of this.data.messages) {
        if ((m.fromUserId === userId && m.toUserId === contactId) || (m.fromUserId === contactId && m.toUserId === userId)) {
          m.hiddenForUserIds = m.hiddenForUserIds || [];
          if (!m.hiddenForUserIds.includes(requestedByUserId)) {
            m.hiddenForUserIds.push(requestedByUserId);
            count++;
          }
        }
      }
      this.save();
      return { success: true, mode: 'for_me', clearedCount: count };
    }

    // mode === 'for_everyone'
    const remaining: EncryptedMessagePacket[] = [];
    for (const m of this.data.messages) {
      const isChat = (m.fromUserId === userId && m.toUserId === contactId) || (m.fromUserId === contactId && m.toUserId === userId);
      if (isChat) {
        count++;
        if (m.mediaUrl) {
          const fileName = path.basename(m.mediaUrl);
          const filePath = path.join(STORAGE_DIR, fileName);
          if (fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch (e) {}
          }
        }
      } else {
        remaining.push(m);
      }
    }
    this.data.messages = remaining;
    this.save();
    return { success: true, mode: 'for_everyone', clearedCount: count };
  }

  deleteChatPhotos(
    userId: string,
    contactId: string,
    requestedByUserId: string,
    mode: 'for_me' | 'for_everyone' = 'for_me',
    guardianAuthorized: boolean = false
  ): { success: boolean; reason?: string; mode: 'for_me' | 'for_everyone'; deletedCount: number; deletedIds: string[] } {
    const userA = this.data.users[userId];
    const userB = this.data.users[contactId];
    const requester = this.data.users[requestedByUserId];

    const aIsMinor = userA && (userA.role === 'kid' || userA.role === 'teen' || (userA.age !== undefined && userA.age < 18));
    const bIsMinor = userB && (userB.role === 'kid' || userB.role === 'teen' || (userB.age !== undefined && userB.age < 18));
    const involvesMinor = aIsMinor || bIsMinor;

    const legalGuardianId = aIsMinor ? userA?.guardianId : userB?.guardianId;
    const isLegalGuardian = requestedByUserId === legalGuardianId || (requester?.role === 'guardian' && !legalGuardianId);

    if (involvesMinor) {
      if (mode === 'for_everyone') {
        if (!isLegalGuardian && !guardianAuthorized) {
          return {
            success: false,
            reason: 'Política de protección infantil: Eliminar fotos para todos en conversaciones con menores (<18 años) está restringido a su tutor legal registrado.',
            mode,
            deletedCount: 0,
            deletedIds: []
          };
        }
      } else {
        const requesterIsMinor = requester && (requester.role === 'kid' || requester.role === 'teen' || (requester.age !== undefined && requester.age < 18));
        if (requesterIsMinor && !guardianAuthorized) {
          return {
            success: false,
            reason: 'Política de protección infantil: En cuentas de menores, eliminar fotos requiere el PIN de guardián.',
            mode,
            deletedCount: 0,
            deletedIds: []
          };
        }
      }
    }

    const deletedIds: string[] = [];
    if (mode === 'for_me') {
      for (const m of this.data.messages) {
        const isPhoto = m.type === 'image' && ((m.fromUserId === userId && m.toUserId === contactId) || (m.fromUserId === contactId && m.toUserId === userId));
        if (isPhoto) {
          m.hiddenForUserIds = m.hiddenForUserIds || [];
          if (!m.hiddenForUserIds.includes(requestedByUserId)) {
            m.hiddenForUserIds.push(requestedByUserId);
            deletedIds.push(m.id);
          }
        }
      }
      this.save();
      return { success: true, mode: 'for_me', deletedCount: deletedIds.length, deletedIds };
    }

    // mode === 'for_everyone'
    const remaining: EncryptedMessagePacket[] = [];
    for (const m of this.data.messages) {
      const isPhoto = m.type === 'image' && ((m.fromUserId === userId && m.toUserId === contactId) || (m.fromUserId === contactId && m.toUserId === userId));
      if (isPhoto) {
        deletedIds.push(m.id);
        if (m.mediaUrl) {
          const fileName = path.basename(m.mediaUrl);
          const filePath = path.join(STORAGE_DIR, fileName);
          if (fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch (e) {}
          }
        }
      } else {
        remaining.push(m);
      }
    }
    this.data.messages = remaining;
    this.save();
    return { success: true, mode: 'for_everyone', deletedCount: deletedIds.length, deletedIds };
  }
}

export const db = new Database();
export { STORAGE_DIR };
