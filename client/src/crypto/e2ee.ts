import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';

export interface UserKeyPair {
  publicKeyBase64: string;
  privateKeyBase64: string;
}

export interface EncryptedResult {
  ciphertext: string; // Base64
  iv: string; // Base64 (nonce)
  senderEphemeralKey: string; // Base64
  encryptedKeyForSender?: string; // Base64
  encryptedKeyForRecipient: string; // Base64
  encryptedKeyForMirror?: string; // Base64
}

// 1. Generate X25519 Identity Keypair
export async function generateIdentityKeyPair(): Promise<UserKeyPair> {
  const pair = nacl.box.keyPair();
  return {
    publicKeyBase64: naclUtil.encodeBase64(pair.publicKey),
    privateKeyBase64: naclUtil.encodeBase64(pair.secretKey)
  };
}

/**
 * 1.1 Deterministic Master Key Derivation (Zero-Knowledge)
 * Derives a permanent sovereign Curve25519 keypair from the user credentials
 * so that keys are never lost across device changes, browser refreshes, or updates.
 */
export async function deriveDeterministicKeyPair(
  username: string,
  secret: string = '',
  userId: string = ''
): Promise<UserKeyPair> {
  const enc = new TextEncoder();
  const effectiveSecret = secret.trim() || `kid_sovereign_seed_${userId || username}`;
  const salt = enc.encode(`family_chat_sovereign_salt_${userId || username}`);

  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(effectiveSecret),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );

  const seed = new Uint8Array(derivedBits);
  const pair = nacl.box.keyPair.fromSecretKey(seed);

  return {
    publicKeyBase64: naclUtil.encodeBase64(pair.publicKey),
    privateKeyBase64: naclUtil.encodeBase64(pair.secretKey)
  };
}

export function derivePublicKey(privateKeyBase64: string): string {
  try {
    const secretKey = naclUtil.decodeBase64(privateKeyBase64);
    if (secretKey.length === 32) {
      const pair = nacl.box.keyPair.fromSecretKey(secretKey);
      return naclUtil.encodeBase64(pair.publicKey);
    }
  } catch (e) {
    console.error('Error deriving public key:', e);
  }
  return '';
}

export async function exportPrivateKey(keyBase64: string): Promise<string> {
  return keyBase64;
}

export async function importPrivateKey(keyBase64: string): Promise<string> {
  return keyBase64;
}

// 2. Encrypt Text (XSalsa20-Poly1305 + Ephemeral X25519 Box)
export async function encryptTextMessage(
  text: string,
  recipientPublicKeyBase64: string,
  mirrorPublicKeyBase64?: string,
  senderPublicKeyBase64?: string
): Promise<EncryptedResult> {
  const recipientPubKey = naclUtil.decodeBase64(recipientPublicKeyBase64);
  if (recipientPubKey.length !== 32) {
    throw new Error('La clave del contacto no tiene formato Curve25519 (32 bytes). Por favor pide que vuelva a entrar.');
  }

  // Ephemeral symmetric key
  const symmetricKey = nacl.randomBytes(nacl.secretbox.keyLength);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);

  // Encrypt text with XSalsa20-Poly1305
  const messageBytes = naclUtil.decodeUTF8(text);
  const ciphertext = nacl.secretbox(messageBytes, nonce, symmetricKey);

  // Ephemeral box keypair to wrap the symmetric key
  const ephemeral = nacl.box.keyPair();
  const boxNonce = nacl.randomBytes(nacl.box.nonceLength);

  const encKeyForRecipient = nacl.box(symmetricKey, boxNonce, recipientPubKey, ephemeral.secretKey);

  let encKeyForSender: string | undefined = undefined;
  if (senderPublicKeyBase64) {
    const senderPubKey = naclUtil.decodeBase64(senderPublicKeyBase64);
    if (senderPubKey.length === 32) {
      const encKeySender = nacl.box(symmetricKey, boxNonce, senderPubKey, ephemeral.secretKey);
      const senderPayload = new Uint8Array(boxNonce.length + encKeySender.length);
      senderPayload.set(boxNonce, 0);
      senderPayload.set(encKeySender, boxNonce.length);
      encKeyForSender = naclUtil.encodeBase64(senderPayload);
    }
  }

  let encKeyForMirror: string | undefined = undefined;
  if (mirrorPublicKeyBase64) {
    const mirrorPubKey = naclUtil.decodeBase64(mirrorPublicKeyBase64);
    if (mirrorPubKey.length === 32) {
      const encKeyMirror = nacl.box(symmetricKey, boxNonce, mirrorPubKey, ephemeral.secretKey);
      const mirrorPayload = new Uint8Array(boxNonce.length + encKeyMirror.length);
      mirrorPayload.set(boxNonce, 0);
      mirrorPayload.set(encKeyMirror, boxNonce.length);
      encKeyForMirror = naclUtil.encodeBase64(mirrorPayload);
    }
  }

  // Prepend boxNonce to the wrapped keys for transport
  const recipientPayload = new Uint8Array(boxNonce.length + encKeyForRecipient.length);
  recipientPayload.set(boxNonce, 0);
  recipientPayload.set(encKeyForRecipient, boxNonce.length);

  return {
    ciphertext: naclUtil.encodeBase64(ciphertext),
    iv: naclUtil.encodeBase64(nonce),
    senderEphemeralKey: naclUtil.encodeBase64(ephemeral.publicKey),
    encryptedKeyForSender: encKeyForSender,
    encryptedKeyForRecipient: naclUtil.encodeBase64(recipientPayload),
    encryptedKeyForMirror: encKeyForMirror
  };
}

// 3. Decrypt Text
export async function decryptTextMessage(
  ciphertextBase64: string,
  ivBase64: string,
  encryptedKeyWithNonceBase64: string,
  senderEphemeralKeyBase64: string,
  myPrivateKeyBase64: string,
  fallbackPrivateKeys: string[] = []
): Promise<string> {
  try {
    const rawKeyPayload = naclUtil.decodeBase64(encryptedKeyWithNonceBase64);
    const boxNonce = rawKeyPayload.slice(0, nacl.box.nonceLength);
    const encKey = rawKeyPayload.slice(nacl.box.nonceLength);

    const senderEphemeralKey = naclUtil.decodeBase64(senderEphemeralKeyBase64);
    const mySecretKey = naclUtil.decodeBase64(myPrivateKeyBase64);

    if (senderEphemeralKey.length !== 32 || mySecretKey.length !== 32) {
      return '🔒 [Clave inválida]';
    }

    // Unbox symmetric key using primary key or fallback keys from keyring
    let symmetricKey = nacl.box.open(encKey, boxNonce, senderEphemeralKey, mySecretKey);
    if (!symmetricKey && fallbackPrivateKeys.length > 0) {
      for (const altKey of fallbackPrivateKeys) {
        try {
          const altSecret = naclUtil.decodeBase64(altKey);
          if (altSecret.length === 32) {
            const opened = nacl.box.open(encKey, boxNonce, senderEphemeralKey, altSecret);
            if (opened) {
              symmetricKey = opened;
              break;
            }
          }
        } catch (e) {}
      }
    }

    if (!symmetricKey) {
      console.warn('Could not open symmetric key box with any known key in keyring.');
      return '🔒 [Mensaje protegido con otra clave]';
    }

    // Decrypt message
    const ciphertext = naclUtil.decodeBase64(ciphertextBase64);
    const nonce = naclUtil.decodeBase64(ivBase64);
    const decryptedBytes = nacl.secretbox.open(ciphertext, nonce, symmetricKey);

    if (!decryptedBytes) {
      return '🔒 [Error al descifrar contenido]';
    }

    return naclUtil.encodeUTF8(decryptedBytes);
  } catch (err) {
    console.warn('Decryption failed:', err);
    return '🔒 [Mensaje cifrado punto a punto]';
  }
}

// 4. Encrypt Media Blob (Photos / Audio)
export async function encryptMediaBlob(
  fileBlob: Blob,
  recipientPublicKeyBase64: string,
  mirrorPublicKeyBase64?: string,
  senderPublicKeyBase64?: string
): Promise<{
  encryptedBlob: Blob;
  iv: string;
  senderEphemeralKey: string;
  encryptedKeyForSender?: string;
  encryptedKeyForRecipient: string;
  encryptedKeyForMirror?: string;
}> {
  const recipientPubKey = naclUtil.decodeBase64(recipientPublicKeyBase64);
  if (recipientPubKey.length !== 32) {
    throw new Error('La clave del contacto no tiene 32 bytes.');
  }

  const symmetricKey = nacl.randomBytes(nacl.secretbox.keyLength);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);

  const arrayBuffer = await fileBlob.arrayBuffer();
  const fileBytes = new Uint8Array(arrayBuffer);
  const ciphertext = nacl.secretbox(fileBytes, nonce, symmetricKey);

  const ephemeral = nacl.box.keyPair();
  const boxNonce = nacl.randomBytes(nacl.box.nonceLength);

  const encKeyForRecipient = nacl.box(symmetricKey, boxNonce, recipientPubKey, ephemeral.secretKey);

  const recipientPayload = new Uint8Array(boxNonce.length + encKeyForRecipient.length);
  recipientPayload.set(boxNonce, 0);
  recipientPayload.set(encKeyForRecipient, boxNonce.length);

  let encKeyForSender: string | undefined = undefined;
  if (senderPublicKeyBase64) {
    const senderPubKey = naclUtil.decodeBase64(senderPublicKeyBase64);
    if (senderPubKey.length === 32) {
      const encKeySender = nacl.box(symmetricKey, boxNonce, senderPubKey, ephemeral.secretKey);
      const senderPayload = new Uint8Array(boxNonce.length + encKeySender.length);
      senderPayload.set(boxNonce, 0);
      senderPayload.set(encKeySender, boxNonce.length);
      encKeyForSender = naclUtil.encodeBase64(senderPayload);
    }
  }

  let encKeyForMirror: string | undefined = undefined;
  if (mirrorPublicKeyBase64) {
    const mirrorPubKey = naclUtil.decodeBase64(mirrorPublicKeyBase64);
    if (mirrorPubKey.length === 32) {
      const encKeyMirror = nacl.box(symmetricKey, boxNonce, mirrorPubKey, ephemeral.secretKey);
      const mirrorPayload = new Uint8Array(boxNonce.length + encKeyMirror.length);
      mirrorPayload.set(boxNonce, 0);
      mirrorPayload.set(encKeyMirror, boxNonce.length);
      encKeyForMirror = naclUtil.encodeBase64(mirrorPayload);
    }
  }

  return {
    encryptedBlob: new Blob([ciphertext], { type: 'application/octet-stream' }),
    iv: naclUtil.encodeBase64(nonce),
    senderEphemeralKey: naclUtil.encodeBase64(ephemeral.publicKey),
    encryptedKeyForSender: encKeyForSender,
    encryptedKeyForRecipient: naclUtil.encodeBase64(recipientPayload),
    encryptedKeyForMirror: encKeyForMirror
  };
}

// Detect real audio container format from raw decrypted bytes
export function detectAudioMime(bytes: Uint8Array, fallback: string = 'audio/webm'): string {
  if (bytes.length >= 4) {
    // WebM / EBML: 0x1A 0x45 0xDF 0xA3
    if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
      return 'audio/webm';
    }
    // Ogg: 'OggS' (0x4F 0x67 0x67 0x53)
    if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
      return 'audio/ogg';
    }
    // MP3: 'ID3' or syncword 0xFF 0xFB/0xF3/0xF2
    if ((bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
        (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) {
      return 'audio/mpeg';
    }
    // WAV: 'RIFF' (0x52 0x49 0x46 0x46)
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
      return 'audio/wav';
    }
  }
  if (bytes.length >= 12) {
    // MP4 / M4A: 'ftyp' at offset 4
    const ftyp = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
    if (ftyp === 'ftyp') {
      return 'audio/mp4';
    }
  }
  return fallback;
}

// 5. Decrypt Media Blob
export async function decryptMediaBlob(
  encryptedBlobUrl: string,
  encryptedKeyWithNonceBase64: string,
  ivBase64: string,
  senderEphemeralKeyBase64: string,
  myPrivateKeyBase64: string,
  targetMimeType: string,
  fallbackPrivateKeys: string[] = []
): Promise<string> {
  const res = await fetch(encryptedBlobUrl);
  if (!res.ok) {
    throw new Error(`Media download failed: HTTP ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const ciphertext = new Uint8Array(arrayBuffer);

  const rawKeyPayload = naclUtil.decodeBase64(encryptedKeyWithNonceBase64);
  const boxNonce = rawKeyPayload.slice(0, nacl.box.nonceLength);
  const encKey = rawKeyPayload.slice(nacl.box.nonceLength);

  const senderEphemeralKey = naclUtil.decodeBase64(senderEphemeralKeyBase64);
  const mySecretKey = naclUtil.decodeBase64(myPrivateKeyBase64);

  let symmetricKey = nacl.box.open(encKey, boxNonce, senderEphemeralKey, mySecretKey);
  if (!symmetricKey && fallbackPrivateKeys.length > 0) {
    for (const altKey of fallbackPrivateKeys) {
      try {
        const altSecret = naclUtil.decodeBase64(altKey);
        if (altSecret.length === 32) {
          const opened = nacl.box.open(encKey, boxNonce, senderEphemeralKey, altSecret);
          if (opened) {
            symmetricKey = opened;
            break;
          }
        }
      } catch (e) {}
    }
  }

  if (!symmetricKey) {
    throw new Error('Could not unbox media symmetric key');
  }

  const nonce = naclUtil.decodeBase64(ivBase64);
  const decryptedBytes = nacl.secretbox.open(ciphertext, nonce, symmetricKey);
  if (!decryptedBytes) {
    throw new Error('Could not decrypt media ciphertext');
  }

  let finalMime = targetMimeType;
  if (targetMimeType.startsWith('audio/')) {
    finalMime = detectAudioMime(decryptedBytes, targetMimeType);
  }

  const blob = new Blob([decryptedBytes], { type: finalMime });
  return URL.createObjectURL(blob);
}
