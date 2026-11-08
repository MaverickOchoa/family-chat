import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { db, STORAGE_DIR } from './db.js';
import type { UserProfile, UserRole, WSClientMessage, EncryptedMessagePacket, PairingInvitation, GuardianHandshakeRequest } from './types.js';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS setup
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));

// Multer storage for encrypted blobs (photos, voice notes)
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, STORAGE_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.bin';
    const unique = `${uuidv4()}${ext}`;
    cb(null, unique);
  }
});
const upload = multer({ storage, limits: { fileSize: 30 * 1024 * 1024 } }); // 30MB limit

// --- HTTP REST ENDPOINTS ---

// Root status endpoint
app.get('/', (_req, res) => {
  res.send(`
    <html>
      <body style="font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 90vh; background: #0f172a; color: white;">
        <h2>🔒 Servidor Relay de Family-Chat Activo</h2>
        <p style="color: #94a3b8;">Este es el backend de cifrado y retransmisión.</p>
        <p>Para usar la aplicación de mensajería, entra aquí:</p>
        <a href="http://localhost:5173" style="padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 12px; font-weight: bold; margin-top: 10px;">👉 Abrir la App de Chat (http://localhost:5173)</a>
      </body>
    </html>
  `);
});

// Version & Health check
app.get('/api/version', (_req, res) => {
  res.json({
    status: 'ok',
    version: 'mongodb-persistent-v1',
    mongoConnected: db.isMongoConnected(),
    mongoError: db.mongoError,
    usersCount: db.getAllUsers().length
  });
});

// 1. Register User (No phone number required)
app.post('/api/auth/register', (req, res) => {
  try {
    const { username, email, password, role, age, guardianId, publicKey, avatar } = req.body;

    if (!username || !role || !publicKey) {
      return res.status(400).json({ error: 'Username, role and publicKey are required.' });
    }

    if (role === 'guardian') {
      if (!email || !/\S+@\S+\.\S+/.test(email)) {
        return res.status(400).json({ error: 'Se requiere un correo electrónico válido para la cuenta de Guardián.' });
      }
      const existingEmail = db.getUserByEmail(email);
      if (existingEmail) {
        return res.status(409).json({ error: 'Este correo electrónico ya está registrado.' });
      }
    }

    if (password) {
      const pwd = String(password);
      if (pwd.length < 8 || !/[A-Z]/.test(pwd) || !/[a-z]/.test(pwd) || !/[^A-Za-z0-9]/.test(pwd)) {
        return res.status(400).json({
          error: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un signo especial.'
        });
      }
    }

    const existing = db.getUserByUsername(username);
    if (existing) {
      return res.status(409).json({ error: 'Username already in use. Please choose another.' });
    }

    let defaultAvatar = avatar;
    if (!defaultAvatar) {
      if (role === 'kid') {
        defaultAvatar = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${encodeURIComponent(username)}`;
      } else if (role === 'teen') {
        defaultAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(username)}&backgroundColor=0891b2,0d9488,4f46e5`;
      } else {
        defaultAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(username)}&backgroundColor=4f46e5,0284c7,7c3aed,059669`;
      }
    }

    const newUser: UserProfile = {
      id: uuidv4(),
      username: username.trim(),
      email: email ? email.trim().toLowerCase() : undefined,
      passwordHash: password ? String(password) : undefined,
      role: role as 'guardian' | 'teen' | 'kid',
      age: age ? Number(age) : (role === 'guardian' ? 35 : undefined),
      guardianId: guardianId || undefined,
      publicKey,
      avatar: defaultAvatar,
      createdAt: new Date().toISOString()
    };

    db.createUser(newUser);

    // If registered as a child/teen with guardianId, automatically establish mutual contact with guardian
    if (guardianId && (role === 'kid' || role === 'teen')) {
      db.addContact(newUser.id, guardianId, guardianId);
    }

    return res.json({ success: true, user: newUser });
  } catch (err: any) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// 1.1 Update User Avatar
app.post('/api/users/:id/avatar', (req, res) => {
  const { id } = req.params;
  const { avatar } = req.body;
  if (!avatar) {
    return res.status(400).json({ error: 'Avatar is required.' });
  }
  const updated = db.updateUser(id, { avatar });
  if (!updated) {
    return res.status(404).json({ error: 'User not found.' });
  }
  return res.json({ success: true, user: updated });
});

// 1.11 Update User Public Key
app.post('/api/users/:id/public-key', (req, res) => {
  const { id } = req.params;
  const { publicKey } = req.body;
  if (!publicKey || typeof publicKey !== 'string' || publicKey.length < 30 || publicKey.length > 60) {
    return res.status(400).json({ error: 'Valid base64 publicKey is required.' });
  }
  const updated = db.updateUser(id, { publicKey });
  if (!updated) {
    return res.status(404).json({ error: 'User not found.' });
  }
  return res.json({ success: true, user: updated });
});

// 1.2 Create Child account directly by Guardian
app.post('/api/guardian/create-child', (req, res) => {
  try {
    const { guardianId, username, password, age, avatar, publicKey } = req.body;
    if (!guardianId || !username) {
      return res.status(400).json({ error: 'guardianId and username are required.' });
    }
    const guardian = db.getUser(guardianId);
    if (!guardian || guardian.role !== 'guardian') {
      return res.status(403).json({ error: 'Only legal guardians can create children accounts.' });
    }
    const existing = db.getUserByUsername(username);
    if (existing) {
      return res.status(409).json({ error: 'Este nombre de usuario ya está en uso. Elige otro para tu hijo/a.' });
    }

    const childAge = age ? Number(age) : 8;
    const childRole: UserRole = childAge >= 10 ? 'teen' : 'kid';
    const defaultAvatar = avatar || (
      childRole === 'teen'
        ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(username)}&backgroundColor=0891b2,0d9488,4f46e5`
        : `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${encodeURIComponent(username)}`
    );

    const newChild: UserProfile = {
      id: uuidv4(),
      username: username.trim(),
      passwordHash: password ? String(password) : undefined,
      role: childRole,
      age: childAge,
      guardianId,
      publicKey: publicKey || '',
      avatar: defaultAvatar,
      createdAt: new Date().toISOString()
    };

    db.createUser(newChild);
    db.addContact(newChild.id, guardianId, guardianId);

    return res.json({ success: true, user: newChild });
  } catch (err: any) {
    console.error('Create child error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// 1.25 Change Guardian PIN
app.post('/api/guardian/change-pin', (req, res) => {
  const { guardianId, currentPin, newPin } = req.body;
  if (!guardianId || !newPin) {
    return res.status(400).json({ error: 'guardianId y newPin son requeridos.' });
  }
  const user = db.getUser(guardianId);
  if (!user || user.role !== 'guardian') {
    return res.status(403).json({ error: 'Solo los guardianes pueden configurar el PIN.' });
  }
  const validCurrent = user.guardianPin || '1234';
  if (currentPin && currentPin !== validCurrent) {
    return res.status(401).json({ error: 'El PIN actual es incorrecto.' });
  }
  if (!/^\d{4,6}$/.test(newPin)) {
    return res.status(400).json({ error: 'El nuevo PIN debe ser de 4 a 6 dígitos numéricos.' });
  }
  const updated = db.updateUser(guardianId, { guardianPin: newPin });
  return res.json({ success: true, user: updated });
});

// 1.2 Get Children of Guardian
app.get('/api/guardian/children/:guardianId', (req, res) => {
  const { guardianId } = req.params;
  const children = db.getChildrenOfGuardian(guardianId);
  return res.json(children);
});

// 1.3 Get Handshakes for Guardian
app.get('/api/guardian/handshakes/:guardianId', (req, res) => {
  const { guardianId } = req.params;
  const handshakes = db.getHandshakesForGuardian(guardianId);
  return res.json(handshakes);
});

// 1.4 Create Cross-Family Handshake Request ("Apretón de Manos entre Madres")
app.post('/api/guardian/handshake/create', (req, res) => {
  try {
    const { fromGuardianId, toGuardianId, fromChildId, toChildId, environment } = req.body;
    if (!fromGuardianId || !toGuardianId || !fromChildId || !toChildId) {
      return res.status(400).json({ error: 'Todos los campos son requeridos.' });
    }

    const fromGuardian = db.getUser(fromGuardianId);
    const toGuardian = db.getUser(toGuardianId);
    const fromChild = db.getUser(fromChildId);
    const toChild = db.getUser(toChildId);

    if (!fromGuardian || !toGuardian || !fromChild || !toChild) {
      return res.status(404).json({ error: 'Uno o más usuarios no fueron encontrados.' });
    }

    const handshake: GuardianHandshakeRequest = {
      id: uuidv4(),
      fromGuardianId,
      fromGuardianName: fromGuardian.username,
      toGuardianId,
      toGuardianName: toGuardian.username,
      fromChildId,
      fromChildName: fromChild.username,
      toChildId,
      toChildName: toChild.username,
      environment: environment || 'church',
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    db.createHandshake(handshake);

    // Notify the other guardian over WebSocket
    broadcastToUser(toGuardianId, {
      type: 'handshake_request',
      handshake
    });

    return res.json({ success: true, handshake });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 1.5 Respond to Cross-Family Handshake Request
app.post('/api/guardian/handshake/respond', (req, res) => {
  try {
    const { handshakeId, guardianId, response, guardianPin } = req.body;
    if (!handshakeId || !guardianId || !response) {
      return res.status(400).json({ error: 'handshakeId, guardianId y response son requeridos.' });
    }

    const handshake = db.getHandshake(handshakeId);
    if (!handshake) {
      return res.status(404).json({ error: 'Solicitud no encontrada.' });
    }

    if (handshake.toGuardianId !== guardianId && handshake.fromGuardianId !== guardianId) {
      return res.status(403).json({ error: 'No tienes autorización sobre esta solicitud.' });
    }

    if (response === 'accept') {
      const gUser = db.getUser(guardianId);
      const expectedPin = gUser?.guardianPin || '1234';
      if (guardianPin !== expectedPin) {
        return res.status(403).json({ error: 'PIN de guardián incorrecto.' });
      }

      const updated = db.updateHandshake(handshakeId, { status: 'accepted' });
      // Mutual contact connection between both children with the agreed environment
      db.addContact(handshake.fromChildId, handshake.toChildId, handshake.toGuardianId, handshake.environment || 'church');

      // Realtime notification to both guardians and both children
      broadcastToUser(handshake.fromGuardianId, { type: 'handshake_accepted', handshake: updated });
      broadcastToUser(handshake.toGuardianId, { type: 'handshake_accepted', handshake: updated });
      broadcastToUser(handshake.fromChildId, { type: 'contact_added', contactId: handshake.toChildId });
      broadcastToUser(handshake.toChildId, { type: 'contact_added', contactId: handshake.fromChildId });

      return res.json({ success: true, handshake: updated });
    } else {
      const updated = db.updateHandshake(handshakeId, { status: 'rejected' });
      broadcastToUser(handshake.fromGuardianId, { type: 'handshake_rejected', handshake: updated });
      return res.json({ success: true, handshake: updated });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 2. Login by Username or Email and optional Password
app.post('/api/auth/login', (req, res) => {
  const { username, password, publicKey } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Username is required.' });
  }
  let user = db.getUserByUsername(username);
  if (!user) {
    user = db.getUserByEmail(username);
  }
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado. Revisa el nombre o regístrate en "Crear Cuenta".' });
  }

  // Validate password if user has one set
  if (user.passwordHash) {
    const entered = String(password || '').trim();
    const cleanHash = user.passwordHash.trim();
    const match =
      entered === cleanHash ||
      entered.replace(/\.$/, '') === cleanHash ||
      entered === cleanHash.replace(/\.$/, '') ||
      (cleanHash + '.') === entered;

    if (!match) {
      return res.status(401).json({ error: 'Contraseña requerida o incorrecta.' });
    }
  } else if (password) {
    // If account was created before password field, assign it now
    user.passwordHash = String(password);
    db.createUser(user);
  }

  // Auto-upgrade key to X25519 if client passes fresh key or if server has old RSA key
  if (publicKey && publicKey.length < 60) {
    user.publicKey = publicKey;
    db.createUser(user);
  }
  return res.json({ success: true, user });
});

// 3. Get User Profile by ID (to retrieve public key for E2EE)
app.get('/api/users/:id', (req, res) => {
  const user = db.getUser(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.json(user);
});

// 4. List Contacts
app.get('/api/contacts/:userId', (req, res) => {
  const { userId } = req.params;
  const user = db.getUser(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const contactLinks = db.getContacts(userId);
  const contactUsers: (UserProfile & { environment?: string })[] = [];

  for (const link of contactLinks) {
    const otherId = link.userId === userId ? link.contactId : link.userId;
    const contactUser = db.getUser(otherId);
    if (contactUser) {
      contactUsers.push({
        ...contactUser,
        environment: link.environment || 'family'
      });
    }
  }

  // Also include children if user is a guardian (so father sees list of his children)
  if (user.role === 'guardian') {
    const all = db.getAllUsers();
    const myKids = all.filter(u => u.guardianId === userId);
    for (const kid of myKids) {
      if (!contactUsers.some(c => c.id === kid.id)) {
        contactUsers.push({
          ...kid,
          environment: 'family'
        });
      }
    }
  }

  return res.json(contactUsers);
});

// 5. Generate Invitation Token (Only Guardian or User)
app.post('/api/invitations/create', (req, res) => {
  const { creatorId, targetRole, targetChildId } = req.body;
  const creator = db.getUser(creatorId);
  if (!creator) {
    return res.status(404).json({ error: 'Creator not found' });
  }

  // Generate 8-character easy code
  const code = Math.random().toString(36).substring(2, 10).toUpperCase();

  const invitation: PairingInvitation = {
    token: code,
    creatorId,
    targetChildId: targetChildId || undefined,
    targetRole: (targetRole as any) || 'guardian',
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    used: false,
    createdAt: new Date().toISOString()
  };

  db.createInvitation(invitation);
  return res.json({ success: true, invitation });
});

// 6. Accept Invitation Token
app.post('/api/invitations/accept', (req, res) => {
  const { token, recipientUserId } = req.body;
  const invitation = db.getInvitation(token?.trim()?.toUpperCase());

  if (!invitation) {
    return res.status(404).json({ error: 'Invalid invitation code.' });
  }
  if (invitation.used || invitation.expiresAt < Date.now()) {
    return res.status(410).json({ error: 'Invitation has expired or already been used.' });
  }

  const recipient = db.getUser(recipientUserId);
  if (!recipient) {
    return res.status(404).json({ error: 'Recipient user not found.' });
  }

  // Target of connection
  const personToConnectId = invitation.targetChildId || invitation.creatorId;

  // Add mutual contact
  const contact = db.addContact(personToConnectId, recipientUserId, invitation.creatorId);
  db.useInvitation(invitation.token);

  const connectedUser = db.getUser(personToConnectId);
  return res.json({ success: true, contact, connectedUser });
});

// 7. Upload Encrypted Media (Zero-Knowledge Ciphertext Blob)
app.post('/api/media/upload', upload.single('blob'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }
  const mediaUrl = `/api/media/${req.file.filename}`;

  // Persist permanently to MongoDB Atlas so audio/photos are indestructible across restarts
  try {
    const fileBuf = fs.readFileSync(req.file.path);
    await db.saveMediaBlob(req.file.filename, fileBuf);
  } catch (err: any) {
    console.warn('Could not persist media to cloud store:', err.message);
  }

  return res.json({
    success: true,
    mediaUrl,
    size: req.file.size
  });
});

// 8. Download Encrypted Blob (with MongoDB Atlas cloud fallback)
app.get('/api/media/:filename', async (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(STORAGE_DIR, filename);
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  // If Render restarted and disk is fresh, recover blob from MongoDB Atlas
  const blobBuffer = await db.getMediaBlob(filename);
  if (blobBuffer) {
    try {
      fs.writeFileSync(filePath, blobBuffer);
    } catch (e) {}
    res.setHeader('Content-Type', 'application/octet-stream');
    return res.send(blobBuffer);
  }
  return res.status(404).json({ error: 'Media not found.' });
});

// 9. Sync Message History (for offline recovery & active sessions)
app.get('/api/messages/:userId', (req, res) => {
  const messages = db.getMessagesForUser(req.params.userId);
  return res.json(messages);
});

// 9.1 Send Message (HTTP fallback for WebSockets)
app.post('/api/messages/send', (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message packet required' });
  const packet: EncryptedMessagePacket = message;

  const sender = db.getUser(packet.fromUserId);
  const recipient = db.getUser(packet.toUserId);

  if (sender?.role === 'kid' && sender.age && sender.age < 10 && sender.guardianId) {
    packet.mirrorUserId = sender.guardianId;
  } else if (recipient?.role === 'kid' && recipient.age && recipient.age < 10 && recipient.guardianId) {
    packet.mirrorUserId = recipient.guardianId;
  }

  db.saveMessage(packet);

  // Deliver to recipient
  broadcastToUser(packet.toUserId, {
    type: 'new_message',
    message: packet
  });

  // Deliver to mirror guardians if kid < 10 (supports both families having mirror view)
  const mirrorGuardiansToNotify = new Set<string>();
  if (sender?.role === 'kid' && sender.age && sender.age < 10 && sender.guardianId) {
    mirrorGuardiansToNotify.add(sender.guardianId);
  }
  if (recipient?.role === 'kid' && recipient.age && recipient.age < 10 && recipient.guardianId) {
    mirrorGuardiansToNotify.add(recipient.guardianId);
  }

  for (const gId of mirrorGuardiansToNotify) {
    if (gId !== packet.fromUserId) {
      broadcastToUser(gId, {
        type: 'mirror_message',
        message: packet
      });
    }
  }

  return res.json({ success: true, messageId: packet.id });
});

// 10. Delete Message (Supports 'for_me' and 'for_everyone')
app.post('/api/messages/delete', (req, res) => {
  const { messageId, requestedByUserId, mode, guardianAuthorized } = req.body;
  if (!messageId || !requestedByUserId) {
    return res.status(400).json({ error: 'messageId and requestedByUserId are required.' });
  }

  const deleteMode = mode === 'for_me' ? 'for_me' : 'for_everyone';
  const result = db.deleteMessage(messageId, requestedByUserId, deleteMode, !!guardianAuthorized);
  if (!result.success) {
    return res.status(403).json({ error: result.reason });
  }

  if (result.mode === 'for_everyone') {
    broadcastToAll({
      type: 'delete_message',
      messageId,
      mode: 'for_everyone'
    });
  } else {
    broadcastToUser(requestedByUserId, {
      type: 'delete_message',
      messageId,
      mode: 'for_me'
    });
  }

  return res.json({ success: true, mode: result.mode });
});

// 10.1 Edit Message (Text content re-encrypted)
app.post('/api/messages/edit', (req, res) => {
  const { messageId, updatedFields, requestedByUserId, guardianAuthorized } = req.body;
  if (!messageId || !requestedByUserId || !updatedFields) {
    return res.status(400).json({ error: 'messageId, requestedByUserId and updatedFields are required.' });
  }

  const result = db.editMessage(messageId, updatedFields, requestedByUserId, !!guardianAuthorized);
  if (!result.success || !result.message) {
    return res.status(403).json({ error: result.reason || 'No se pudo editar el mensaje.' });
  }

  const msg = result.message;
  broadcastToUser(msg.toUserId, {
    type: 'edit_message',
    message: msg
  });
  broadcastToUser(msg.fromUserId, {
    type: 'edit_message',
    message: msg
  });
  if (msg.mirrorUserId) {
    broadcastToUser(msg.mirrorUserId, {
      type: 'edit_message',
      message: msg
    });
  }

  return res.json({ success: true, message: msg });
});

// 10.2 Clear Entire Chat
app.post('/api/messages/clear', (req, res) => {
  const { userId, contactId, requestedByUserId, mode, guardianAuthorized } = req.body;
  if (!userId || !contactId || !requestedByUserId) {
    return res.status(400).json({ error: 'userId, contactId and requestedByUserId are required.' });
  }

  const clearMode = mode === 'for_everyone' ? 'for_everyone' : 'for_me';
  const result = db.clearChat(userId, contactId, requestedByUserId, clearMode, !!guardianAuthorized);
  if (!result.success) {
    return res.status(403).json({ error: result.reason });
  }

  if (result.mode === 'for_everyone') {
    broadcastToUser(userId, {
      type: 'clear_chat',
      contactId,
      mode: 'for_everyone'
    });
    broadcastToUser(contactId, {
      type: 'clear_chat',
      contactId: userId,
      mode: 'for_everyone'
    });
  } else {
    broadcastToUser(requestedByUserId, {
      type: 'clear_chat',
      contactId: requestedByUserId === userId ? contactId : userId,
      mode: 'for_me'
    });
  }

  return res.json({ success: true, mode: result.mode, clearedCount: result.clearedCount });
});

// 10.3 Delete all photos of a specific chat
app.post('/api/messages/delete-photos', (req, res) => {
  const { userId, contactId, requestedByUserId, mode, guardianAuthorized } = req.body;
  if (!userId || !contactId || !requestedByUserId) {
    return res.status(400).json({ error: 'userId, contactId and requestedByUserId are required.' });
  }

  const deleteMode = mode === 'for_everyone' ? 'for_everyone' : 'for_me';
  const result = db.deleteChatPhotos(userId, contactId, requestedByUserId, deleteMode, !!guardianAuthorized);
  if (!result.success) {
    return res.status(403).json({ error: result.reason });
  }

  if (result.mode === 'for_everyone') {
    for (const msgId of result.deletedIds) {
      broadcastToAll({
        type: 'delete_message',
        messageId: msgId,
        mode: 'for_everyone'
      });
    }
  } else {
    for (const msgId of result.deletedIds) {
      broadcastToUser(requestedByUserId, {
        type: 'delete_message',
        messageId: msgId,
        mode: 'for_me'
      });
    }
  }

  return res.json({ success: true, mode: result.mode, deletedCount: result.deletedCount, deletedIds: result.deletedIds });
});

// --- WEBSOCKET SERVER (BLIND RELAY) ---

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Map of userId -> Set of active WebSockets (supports multiple tabs / devices)
const userSockets = new Map<string, Set<WebSocket>>();

function broadcastToUser(userId: string, data: any) {
  const sockets = userSockets.get(userId);
  if (sockets) {
    const payload = JSON.stringify(data);
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }
}

function broadcastToAll(data: any) {
  const payload = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

wss.on('connection', (ws) => {
  let authenticatedUserId: string | null = null;

  ws.on('message', (raw) => {
    try {
      const msg: WSClientMessage = JSON.parse(raw.toString());

      switch (msg.type) {
        case 'auth': {
          if (msg.userId) {
            authenticatedUserId = msg.userId;
            if (!userSockets.has(authenticatedUserId)) {
              userSockets.set(authenticatedUserId, new Set());
            }
            userSockets.get(authenticatedUserId)!.add(ws);

            if (msg.publicKey && msg.publicKey.length < 60) {
              const u = db.getUser(authenticatedUserId);
              if (u && u.publicKey !== msg.publicKey) {
                db.updateUser(authenticatedUserId, { publicKey: msg.publicKey });
              }
            }

            // Notify presence to contacts
            broadcastPresence(authenticatedUserId, true);

            // Send initial online user IDs to the connected user
            const currentOnlineUserIds = Array.from(userSockets.keys());
            ws.send(JSON.stringify({
              type: 'initial_presence',
              onlineUserIds: currentOnlineUserIds
            }));
          }
          break;
        }

        case 'presence_state': {
          if (authenticatedUserId) {
            broadcastPresence(authenticatedUserId, !!msg.isOnline);
          }
          break;
        }

        case 'send_message': {
          if (!msg.message || !authenticatedUserId) return;
          const packet: EncryptedMessagePacket = msg.message;

          // Check if sender or recipient is a kid < 10 to establish mirrorUserId for parent audit
          const sender = db.getUser(packet.fromUserId);
          const recipient = db.getUser(packet.toUserId);

          if (sender?.role === 'kid' && sender.age && sender.age < 10 && sender.guardianId) {
            packet.mirrorUserId = sender.guardianId;
          } else if (recipient?.role === 'kid' && recipient.age && recipient.age < 10 && recipient.guardianId) {
            packet.mirrorUserId = recipient.guardianId;
          }

          // Persist blinded packet
          db.saveMessage(packet);

          // 1. Deliver directly to recipient
          broadcastToUser(packet.toUserId, {
            type: 'new_message',
            message: packet
          });

          // 2. Deliver to mirror guardians if kid < 10 (supports both families having mirror view)
          const mirrorGuardiansToNotify = new Set<string>();
          if (sender?.role === 'kid' && sender.age && sender.age < 10 && sender.guardianId) {
            mirrorGuardiansToNotify.add(sender.guardianId);
          }
          if (recipient?.role === 'kid' && recipient.age && recipient.age < 10 && recipient.guardianId) {
            mirrorGuardiansToNotify.add(recipient.guardianId);
          }

          for (const gId of mirrorGuardiansToNotify) {
            if (gId !== authenticatedUserId) {
              broadcastToUser(gId, {
                type: 'mirror_message',
                message: packet
              });
            }
          }

          // 3. ACK back to sender
          ws.send(JSON.stringify({
            type: 'message_sent_ack',
            messageId: packet.id,
            status: 'sent'
          }));
          break;
        }

        case 'ack': {
          const ids: string[] = [];
          if (msg.messageId) ids.push(msg.messageId);
          if (Array.isArray((msg as any).messageIds)) ids.push(...(msg as any).messageIds);

          if (ids.length > 0 && msg.status) {
            for (const id of ids) {
              db.updateMessageStatus(id, msg.status);
              broadcastToAll({
                type: 'status_update',
                messageId: id,
                status: msg.status
              });
            }
          }
          break;
        }

        case 'typing': {
          if (msg.userId && authenticatedUserId) {
            broadcastToUser(msg.userId, {
              type: 'typing',
              fromUserId: authenticatedUserId
            });
          }
          break;
        }

        case 'delete_message': {
          if (msg.messageId && authenticatedUserId) {
            const deleteMode = msg.mode === 'for_me' ? 'for_me' : 'for_everyone';
            const result = db.deleteMessage(msg.messageId, authenticatedUserId, deleteMode, !!msg.guardianAuthorized);
            if (result.success) {
              if (result.mode === 'for_everyone') {
                broadcastToAll({
                  type: 'delete_message',
                  messageId: msg.messageId,
                  mode: 'for_everyone'
                });
              } else {
                broadcastToUser(authenticatedUserId, {
                  type: 'delete_message',
                  messageId: msg.messageId,
                  mode: 'for_me'
                });
              }
            }
          }
          break;
        }

        case 'edit_message': {
          if (msg.messageId && msg.message && authenticatedUserId) {
            const result = db.editMessage(msg.messageId, msg.message, authenticatedUserId, !!msg.guardianAuthorized);
            if (result.success && result.message) {
              const updated = result.message;
              broadcastToUser(updated.toUserId, { type: 'edit_message', message: updated });
              broadcastToUser(updated.fromUserId, { type: 'edit_message', message: updated });
              if (updated.mirrorUserId) {
                broadcastToUser(updated.mirrorUserId, { type: 'edit_message', message: updated });
              }
            }
          }
          break;
        }

        case 'clear_chat': {
          if (msg.contactId && authenticatedUserId) {
            const clearMode = msg.mode === 'for_everyone' ? 'for_everyone' : 'for_me';
            const result = db.clearChat(authenticatedUserId, msg.contactId, authenticatedUserId, clearMode, !!msg.guardianAuthorized);
            if (result.success) {
              if (result.mode === 'for_everyone') {
                broadcastToUser(authenticatedUserId, { type: 'clear_chat', contactId: msg.contactId, mode: 'for_everyone' });
                broadcastToUser(msg.contactId, { type: 'clear_chat', contactId: authenticatedUserId, mode: 'for_everyone' });
              } else {
                broadcastToUser(authenticatedUserId, { type: 'clear_chat', contactId: msg.contactId, mode: 'for_me' });
              }
            }
          }
          break;
        }
      }
    } catch (e) {
      console.error('WS Error:', e);
    }
  });

  ws.on('close', () => {
    if (authenticatedUserId && userSockets.has(authenticatedUserId)) {
      const set = userSockets.get(authenticatedUserId)!;
      set.delete(ws);
      if (set.size === 0) {
        userSockets.delete(authenticatedUserId);
        broadcastPresence(authenticatedUserId, false);
      }
    }
  });
});

function broadcastPresence(userId: string, isOnline: boolean) {
  broadcastToAll({
    type: 'presence',
    userId,
    isOnline
  });
}

server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🔒 Family-Chat Relay Server running on port ${PORT}`);
  console.log(`📂 Encrypted Blobs directory: ${STORAGE_DIR}`);
  console.log(`===============================================`);
});
