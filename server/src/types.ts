export type UserRole = 'guardian' | 'teen' | 'kid';

export interface UserProfile {
  id: string;
  username: string;
  email?: string;
  passwordHash?: string;
  role: UserRole;
  age?: number;
  guardianId?: string;
  publicKey: string; // Base64 or JWK
  signaturePublicKey?: string; // For verifying signatures
  avatar?: string;
  createdAt: string;
}

export interface ApprovedContact {
  id: string;
  userId: string;
  contactId: string;
  approvedByGuardianId?: string;
  environment?: string; // 'family' | 'church' | 'work' etc.
  createdAt: string;
}

export interface GuardianHandshakeRequest {
  id: string;
  fromGuardianId: string;
  fromGuardianName: string;
  toGuardianId: string;
  toGuardianName: string;
  fromChildId: string;
  fromChildName: string;
  toChildId: string;
  toChildName: string;
  environment?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface PairingInvitation {
  token: string;
  creatorId: string;
  targetChildId?: string; // If parent created it for their child
  targetRole: UserRole;
  expiresAt: number;
  used: boolean;
  createdAt: string;
}

export interface EncryptedMessagePacket {
  id: string;
  fromUserId: string;
  toUserId: string;
  mirrorUserId?: string; // Populated when sender or recipient is kid < 10
  ciphertext?: string; // Base64 ciphertext for text messages
  encryptedForSender?: string; // Base64 wrapped symmetric key for sender history
  encryptedForRecipient: string; // Base64 wrapped symmetric key for recipient
  encryptedForMirror?: string; // Base64 wrapped symmetric key for guardian
  iv: string;
  type: 'text' | 'image' | 'audio';
  mediaUrl?: string; // Path to encrypted blob if image/audio
  mediaMimeType?: string;
  mediaSize?: number;
  mediaDuration?: number; // For audio notes in seconds
  senderEphemeralKey?: string;
  timestamp: number;
  status: 'sent' | 'delivered' | 'read';
  hiddenForUserIds?: string[]; // IDs of users who deleted this message "for me only"
  isEdited?: boolean;
  editedAt?: number;
  isProtected?: boolean; // When true, photo requires guardian PIN to reveal in chat/vault
}

export interface WSClientMessage {
  type: 'auth' | 'send_message' | 'ack' | 'typing' | 'delete_message' | 'edit_message' | 'clear_chat';
  token?: string;
  userId?: string;
  publicKey?: string;
  message?: EncryptedMessagePacket;
  messageId?: string;
  status?: 'delivered' | 'read';
  deletionSignature?: string;
  mode?: 'for_me' | 'for_everyone';
  contactId?: string;
  guardianAuthorized?: boolean;
}
