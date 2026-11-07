import http from 'node:http';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { db, STORAGE_DIR } from './db.js';
import type { UserProfile, WSClientMessage, EncryptedMessagePacket, PairingInvitation } from './types.js';

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

// 1. Register User (No phone number required)
app.post('/api/auth/register', (req, res) => {
  try {
    const { username, password, role, age, guardianId, publicKey, avatar } = req.body;

    if (!username || !role || !publicKey) {
      return res.status(400).json({ error: 'Username, role and publicKey are required.' });
    }

    const existing = db.getUserByUsername(username);
    if (existing) {
      return res.status(409).json({ error: 'Username already in use. Please choose another.' });
    }

    const newUser: UserProfile = {
      id: uuidv4(),
      username: username.trim(),
      passwordHash: password ? String(password) : undefined,
      role: role as 'guardian' | 'teen' | 'kid',
      age: age ? Number(age) : undefined,
      guardianId: guardianId || undefined,
      publicKey,
      avatar: avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`,
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

// 2. Login by Username and optional Password
app.post('/api/auth/login', (req, res) => {
  const { username, password, publicKey } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Username is required.' });
  }
  const user = db.getUserByUsername(username);
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado. Revisa el nombre o regístrate.' });
  }

  // Validate password if user has one set
  if (user.passwordHash) {
    if (!password || user.passwordHash !== String(password)) {
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
  const contactUsers: UserProfile[] = [];

  for (const link of contactLinks) {
    const otherId = link.userId === userId ? link.contactId : link.userId;
    const contactUser = db.getUser(otherId);
    if (contactUser) {
      contactUsers.push(contactUser);
    }
  }

  // Also include children if user is a guardian (so father sees list of his children)
  if (user.role === 'guardian') {
    const all = db.getAllUsers();
    const myKids = all.filter(u => u.guardianId === userId);
    for (const kid of myKids) {
      if (!contactUsers.some(c => c.id === kid.id)) {
        contactUsers.push(kid);
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
app.post('/api/media/upload', upload.single('blob'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }
  const mediaUrl = `/api/media/${req.file.filename}`;
  return res.json({
    success: true,
    mediaUrl,
    size: req.file.size
  });
});

// 8. Download Encrypted Blob
app.use('/api/media', express.static(STORAGE_DIR));

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

  // Deliver to mirror guardian if kid < 10
  if (packet.mirrorUserId && packet.mirrorUserId !== packet.fromUserId) {
    broadcastToUser(packet.mirrorUserId, {
      type: 'mirror_message',
      message: packet
    });
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

            // Notify presence to contacts
            broadcastPresence(authenticatedUserId, true);
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

          // 2. If mirrorUserId is set (parent audit view for kid < 10), deliver to guardian!
          if (packet.mirrorUserId && packet.mirrorUserId !== authenticatedUserId) {
            broadcastToUser(packet.mirrorUserId, {
              type: 'mirror_message',
              message: packet
            });
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
          if (msg.messageId && msg.status) {
            db.updateMessageStatus(msg.messageId, msg.status);
            broadcastToAll({
              type: 'status_update',
              messageId: msg.messageId,
              status: msg.status
            });
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
