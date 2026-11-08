import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient, type Collection } from 'mongodb';
import type { UserProfile, ApprovedContact, PairingInvitation, EncryptedMessagePacket, GuardianHandshakeRequest } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const STORAGE_DIR = path.join(DATA_DIR, 'encrypted_blobs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://admin:FamiliaChat2026!@chat.pdvv3et.mongodb.net/family-chat?retryWrites=true&w=majority';

interface DatabaseSchema {
  users: Record<string, UserProfile>;
  contacts: ApprovedContact[];
  invitations: Record<string, PairingInvitation>;
  messages: EncryptedMessagePacket[];
  handshakes: Record<string, GuardianHandshakeRequest>;
}

class Database {
  private data: DatabaseSchema = {
    users: {},
    contacts: [],
    invitations: {},
    messages: [],
    handshakes: {}
  };

  private mongoClient: MongoClient | null = null;
  private mongoCollection: Collection | null = null;
  public mongoError: string | null = null;

  constructor() {
    this.init();
    this.initMongo();
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
        if (!this.data.handshakes) {
          this.data.handshakes = {};
        }
      } catch (err) {
        console.error('Failed to parse database file, initializing empty state:', err);
        this.save();
      }
    } else {
      const seedFile = path.resolve(__dirname, '../seed_db.json');
      if (fs.existsSync(seedFile)) {
        try {
          const raw = fs.readFileSync(seedFile, 'utf-8');
          this.data = JSON.parse(raw);
          if (!this.data.handshakes) this.data.handshakes = {};
          this.save();
          return;
        } catch (e) {
          console.error('Failed to load seed database:', e);
        }
      }
      this.save();
    }
  }

  private async initMongo() {
    if (!MONGODB_URI) return;
    try {
      this.mongoClient = new MongoClient(MONGODB_URI);
      await this.mongoClient.connect();
      const db = this.mongoClient.db('family-chat');
      this.mongoCollection = db.collection('sovereign_store');
      console.log('✅ Conectado exitosamente a MongoDB Atlas (Base de Datos Permanente)');

      // Fetch cloud state
      const remote = await this.mongoCollection.findOne({ _id: 'main_store' as any });
      if (remote && (remote as any).data && Object.keys((remote as any).data.users || {}).length > 0) {
        const remoteData = (remote as any).data;
        // Merge cloud with local state seamlessly so no newly created user is lost
        this.data.users = { ...this.data.users, ...(remoteData.users || {}) };
        this.data.handshakes = { ...(this.data.handshakes || {}), ...(remoteData.handshakes || {}) };
        
        // Contacts deduplication
        const allContacts = [...(this.data.contacts || []), ...(remoteData.contacts || [])];
        const seenContacts = new Set<string>();
        this.data.contacts = allContacts.filter(c => {
          const key = [c.userId, c.contactId].sort().join(':');
          if (seenContacts.has(key)) return false;
          seenContacts.add(key);
          return true;
        });

        // Messages deduplication
        const allMsgs = [...(this.data.messages || []), ...(remoteData.messages || [])];
        const seenMsgs = new Set<string>();
        this.data.messages = allMsgs.filter(m => {
          if (seenMsgs.has(m.id)) return false;
          seenMsgs.add(m.id);
          return true;
        });

        const countUsers = Object.keys(this.data.users).length;
        const countMsgs = this.data.messages.length;
        console.log(`📥 Base de datos permanente sincronizada: ${countUsers} usuarios, ${countMsgs} mensajes.`);
        this.saveLocal();
        await this.saveRemote();
      } else {
        console.log('🚀 Inicializando MongoDB Atlas con los datos iniciales de la familia...');
        await this.saveRemote();
      }
    } catch (err: any) {
      this.mongoError = err.message || String(err);
      console.warn('⚠️ MongoDB Atlas aún no disponible o en espera de conexión:', err.message);
      // Retry connection in 15 seconds
      setTimeout(() => this.initMongo(), 15000);
    }
  }

  isMongoConnected(): boolean {
    return this.mongoCollection !== null;
  }

  private save() {
    this.saveLocal();
    this.saveRemote();
  }

  private saveLocal() {
    try {
      const tempFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempFile, DB_FILE);
    } catch (err) {
      console.error('Failed to persist database to local disk:', err);
    }
  }

  private async saveRemote() {
    if (!this.mongoCollection) return;
    try {
      await this.mongoCollection.updateOne(
        { _id: 'main_store' as any },
        { $set: { data: this.data, updatedAt: new Date() } },
        { upsert: true }
      );
    } catch (err: any) {
      console.error('Failed to sync to MongoDB Atlas:', err.message);
    }
  }

  // Users
  getUser(id: string): UserProfile | undefined {
    return this.data.users[id];
  }

  getUserByUsername(username: string): UserProfile | undefined {
    const clean = username.trim().toLowerCase();
    const exact = Object.values(this.data.users).find(u => u.username.toLowerCase() === clean);
    if (exact) return exact;
    // Friendly aliases
    if (clean === 'tany' || clean === 'tania') {
      return Object.values(this.data.users).find(u => u.username.toLowerCase().includes('tania') || u.username.toLowerCase() === 'tany');
    }
    return undefined;
  }

  getUserByEmail(email: string): UserProfile | undefined {
    const clean = email.trim().toLowerCase();
    return Object.values(this.data.users).find(u => u.email && u.email.toLowerCase() === clean);
  }

  updateUser(id: string, updates: Partial<UserProfile>): UserProfile | undefined {
    const user = this.data.users[id];
    if (!user) return undefined;
    const updated = { ...user, ...updates };
    this.data.users[id] = updated;
    this.save();
    return updated;
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

  getChildrenOfGuardian(guardianId: string): UserProfile[] {
    return Object.values(this.data.users).filter(u => u.guardianId === guardianId);
  }

  addContact(userId: string, contactId: string, approvedByGuardianId?: string, environment?: string): ApprovedContact {
    if (this.areContacts(userId, contactId)) {
      const existing = this.data.contacts.find(
        c => (c.userId === userId && c.contactId === contactId) ||
             (c.userId === contactId && c.contactId === userId)
      )!;
      if (environment && !existing.environment) {
        existing.environment = environment;
        this.save();
      }
      return existing;
    }
    const newContact: ApprovedContact = {
      id: crypto.randomUUID(),
      userId,
      contactId,
      approvedByGuardianId,
      environment: environment || 'family',
      createdAt: new Date().toISOString()
    };
    this.data.contacts.push(newContact);
    this.save();
    return newContact;
  }

  // Guardian Handshakes (Cross-family child connection)
  createHandshake(req: GuardianHandshakeRequest): GuardianHandshakeRequest {
    this.data.handshakes[req.id] = req;
    this.save();
    return req;
  }

  getHandshake(id: string): GuardianHandshakeRequest | undefined {
    return this.data.handshakes[id];
  }

  getHandshakesForGuardian(guardianId: string): GuardianHandshakeRequest[] {
    return Object.values(this.data.handshakes).filter(
      h => h.fromGuardianId === guardianId || h.toGuardianId === guardianId
    );
  }

  updateHandshake(id: string, updates: Partial<GuardianHandshakeRequest>): GuardianHandshakeRequest | undefined {
    const h = this.data.handshakes[id];
    if (!h) return undefined;
    const updated = { ...h, ...updates };
    this.data.handshakes[id] = updated;
    this.save();
    return updated;
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
    const user = this.data.users[userId];
    const isGuardian = user?.role === 'guardian';
    const childIds = isGuardian ? this.getChildrenOfGuardian(userId).map(c => c.id) : [];

    return this.data.messages.filter(m => {
      if (m.hiddenForUserIds && m.hiddenForUserIds.includes(userId)) return false;
      if (m.fromUserId === userId || m.toUserId === userId || m.mirrorUserId === userId) return true;
      if (isGuardian && (childIds.includes(m.fromUserId) || childIds.includes(m.toUserId))) {
        const sender = this.data.users[m.fromUserId];
        const recipient = this.data.users[m.toUserId];
        if ((childIds.includes(m.fromUserId) && sender?.age && sender.age < 10) ||
            (childIds.includes(m.toUserId) && recipient?.age && recipient.age < 10)) {
          return true;
        }
      }
      return false;
    });
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
