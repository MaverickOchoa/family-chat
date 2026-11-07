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
  myPrivateKeyBase64: string
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

    // Unbox symmetric key
    const symmetricKey = nacl.box.open(encKey, boxNonce, senderEphemeralKey, mySecretKey);
    if (!symmetricKey) {
      console.warn('Could not open symmetric key box. Check if your private key matches the public key registered on server.');
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

// 5. Decrypt Media Blob
export async function decryptMediaBlob(
  encryptedBlobUrl: string,
  encryptedKeyWithNonceBase64: string,
  ivBase64: string,
  senderEphemeralKeyBase64: string,
  myPrivateKeyBase64: string,
  targetMimeType: string
): Promise<string> {
  const res = await fetch(encryptedBlobUrl);
  const arrayBuffer = await res.arrayBuffer();
  const ciphertext = new Uint8Array(arrayBuffer);

  const rawKeyPayload = naclUtil.decodeBase64(encryptedKeyWithNonceBase64);
  const boxNonce = rawKeyPayload.slice(0, nacl.box.nonceLength);
  const encKey = rawKeyPayload.slice(nacl.box.nonceLength);

  const senderEphemeralKey = naclUtil.decodeBase64(senderEphemeralKeyBase64);
  const mySecretKey = naclUtil.decodeBase64(myPrivateKeyBase64);

  const symmetricKey = nacl.box.open(encKey, boxNonce, senderEphemeralKey, mySecretKey);
  if (!symmetricKey) {
    throw new Error('Could not unbox media symmetric key');
  }

  const nonce = naclUtil.decodeBase64(ivBase64);
  const decryptedBytes = nacl.secretbox.open(ciphertext, nonce, symmetricKey);
  if (!decryptedBytes) {
    throw new Error('Could not decrypt media ciphertext');
  }

  const blob = new Blob([decryptedBytes], { type: targetMimeType });
  return URL.createObjectURL(blob);
}
